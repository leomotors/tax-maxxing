import type { DriveFile } from "./api";

interface StoredFile extends DriveFile {
  content: string;
  appProperties: Record<string, string>;
}

/** In-memory Drive v3 REST stand-in for tests; records every request. */
export function createFakeDrive() {
  const files = new Map<string, StoredFile>();
  const requests: { method: string; url: URL; body?: string; contentType?: string }[] = [];
  let nextId = 1;
  let pageSize = 100;
  let status: number | null = null;
  /** Hook to simulate another device writing during a request. */
  let onRequest: ((method: string, url: URL) => void) | null = null;

  const meta = (f: StoredFile): DriveFile => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    version: f.version,
    trashed: f.trashed,
  });
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const bump = (f: StoredFile) => {
    f.version = String(Number(f.version) + 1);
    f.modifiedTime = new Date(Date.now() + Number(f.version)).toISOString();
  };

  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? init.body : undefined;
    const headers = init.headers as Record<string, string> | undefined;
    requests.push({ method, url, body, contentType: headers?.["Content-Type"] });
    onRequest?.(method, url);
    if (status) return new Response("", { status });

    const upload = url.pathname.startsWith("/upload/");
    const id = url.pathname.split("/files/")[1];

    if (method === "GET" && !id) {
      const all = [...files.values()].filter(
        (f) => !f.trashed && f.appProperties["tax-maxxing"] === "backup",
      );
      const start = Number(url.searchParams.get("pageToken") ?? 0);
      const page = all.slice(start, start + pageSize);
      const more = start + pageSize < all.length;
      return json({ files: page.map(meta), ...(more ? { nextPageToken: String(start + pageSize) } : {}) });
    }
    if (method === "POST" && upload) {
      const boundary = headers?.["Content-Type"]?.split("boundary=")[1] ?? "";
      const parts = (body ?? "").split(`--${boundary}`).slice(1, -1);
      const partBody = (p: string) => p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, "");
      const metadata = JSON.parse(partBody(parts[0])) as {
        name: string;
        appProperties: Record<string, string>;
      };
      const file: StoredFile = {
        id: `file-${nextId++}`,
        name: metadata.name,
        modifiedTime: new Date().toISOString(),
        version: "1",
        content: partBody(parts[1]),
        appProperties: metadata.appProperties,
      };
      files.set(file.id, file);
      return json(meta(file));
    }

    const file = id ? files.get(decodeURIComponent(id)) : undefined;
    if (!file) return new Response("", { status: 404 });
    if (method === "PATCH" && upload) {
      file.content = body ?? "";
      bump(file);
      return json(meta(file));
    }
    if (method === "GET" && url.searchParams.get("alt") === "media") {
      return new Response(file.content, { status: 200 });
    }
    if (method === "GET") return json(meta(file));
    return new Response("", { status: 400 });
  }) as typeof fetch;

  return {
    fetch: fetchImpl,
    files,
    requests,
    seed(content: string, overrides: Partial<StoredFile> = {}) {
      const file: StoredFile = {
        id: `file-${nextId++}`,
        name: "tax-maxxing-backup.json",
        modifiedTime: new Date().toISOString(),
        version: "1",
        content,
        appProperties: { "tax-maxxing": "backup" },
        ...overrides,
      };
      files.set(file.id, file);
      return file;
    },
    /** Simulate a write from another device. */
    touch(id: string, content?: string) {
      const f = files.get(id)!;
      if (content !== undefined) f.content = content;
      bump(f);
    },
    setPageSize(n: number) {
      pageSize = n;
    },
    failWith(code: number | null) {
      status = code;
    },
    onRequest(fn: ((method: string, url: URL) => void) | null) {
      onRequest = fn;
    },
  };
}
