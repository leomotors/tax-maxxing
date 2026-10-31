const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const META_FIELDS = "id,name,modifiedTime,version,trashed";

export const BACKUP_FILENAME = "tax-maxxing-backup.json";
export const APP_PROPERTY = { key: "tax-maxxing", value: "backup" } as const;

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  /** int64 as string — compare as-is, never parse. */
  version: string;
  trashed?: boolean;
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface DriveClient {
  token: string;
  fetch?: typeof fetch;
}

async function call(client: DriveClient, url: string, init: RequestInit = {}) {
  const res = await (client.fetch ?? fetch)(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${client.token}` },
  });
  if (!res.ok) {
    throw new DriveError(`Google Drive ตอบกลับ ${res.status}`, res.status);
  }
  return res;
}

/** All non-trashed backups this app created (drive.file cannot see others). */
export async function listBackups(client: DriveClient): Promise<DriveFile[]> {
  const q = `appProperties has { key='${APP_PROPERTY.key}' and value='${APP_PROPERTY.value}' } and trashed=false`;
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q,
      spaces: "drive",
      orderBy: "modifiedTime desc",
      fields: `nextPageToken,files(${META_FIELDS})`,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await call(client, `${API}?${params}`);
    const body = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

export async function getMeta(client: DriveClient, id: string): Promise<DriveFile> {
  const params = new URLSearchParams({ fields: META_FIELDS });
  const res = await call(client, `${API}/${encodeURIComponent(id)}?${params}`);
  return (await res.json()) as DriveFile;
}

export async function createBackup(client: DriveClient, content: string): Promise<DriveFile> {
  const boundary = `tax-maxxing-${crypto.randomUUID()}`;
  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: "application/json",
    appProperties: { [APP_PROPERTY.key]: APP_PROPERTY.value },
  };
  // Drive requires multipart/related (not FormData's multipart/form-data).
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const params = new URLSearchParams({ uploadType: "multipart", fields: META_FIELDS });
  const res = await call(client, `${UPLOAD}?${params}`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()) as DriveFile;
}

export async function updateBackup(
  client: DriveClient,
  id: string,
  content: string,
): Promise<DriveFile> {
  const params = new URLSearchParams({ uploadType: "media", fields: META_FIELDS });
  const res = await call(client, `${UPLOAD}/${encodeURIComponent(id)}?${params}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: content,
  });
  return (await res.json()) as DriveFile;
}

/**
 * Download content together with the version it belongs to: version is read
 * before and after, so a concurrent write can't pair old bytes with a new version.
 */
export async function downloadBackup(
  client: DriveClient,
  id: string,
): Promise<{ text: string; meta: DriveFile }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await getMeta(client, id);
    const res = await call(client, `${API}/${encodeURIComponent(id)}?alt=media`);
    const text = await res.text();
    const after = await getMeta(client, id);
    if (before.version === after.version) return { text, meta: after };
  }
  throw new DriveError("ไฟล์บน Drive กำลังถูกแก้ไขจากที่อื่น — ลองอีกครั้ง", 409);
}
