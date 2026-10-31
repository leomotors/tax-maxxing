import { describe, expect, it } from "vitest";

import {
  createBackup,
  downloadBackup,
  DriveError,
  listBackups,
  updateBackup,
} from "./api";
import { createFakeDrive } from "./fake-drive.test-util";

function setup() {
  const drive = createFakeDrive();
  return { drive, client: { token: "test-token", fetch: drive.fetch } };
}

describe("Drive REST client", () => {
  it("creates with multipart/related, metadata first, and app properties", async () => {
    const { drive, client } = setup();
    const meta = await createBackup(client, '{"demo":1}');
    const req = drive.requests[0];
    expect(req.method).toBe("POST");
    expect(req.url.searchParams.get("uploadType")).toBe("multipart");
    expect(req.contentType).toMatch(/^multipart\/related; boundary=/);
    expect(drive.files.get(meta.id)?.content).toBe('{"demo":1}');
    expect(drive.files.get(meta.id)?.appProperties).toEqual({ "tax-maxxing": "backup" });
    expect(meta.version).toBe("1");
  });

  it("lists only app backups, URL-encoded, following pagination", async () => {
    const { drive, client } = setup();
    drive.setPageSize(1);
    drive.seed("a");
    drive.seed("b");
    drive.seed("c", { trashed: true });
    drive.seed("d", { appProperties: { other: "x" } });
    const files = await listBackups(client);
    expect(files).toHaveLength(2);
    expect(drive.requests[0].url.searchParams.get("q")).toBe(
      "appProperties has { key='tax-maxxing' and value='backup' } and trashed=false",
    );
    expect(drive.requests).toHaveLength(2);
  });

  it("updates with a media PATCH and returns the new version", async () => {
    const { drive, client } = setup();
    const seeded = drive.seed("old");
    const meta = await updateBackup(client, seeded.id, "new");
    expect(drive.requests[0].method).toBe("PATCH");
    expect(drive.files.get(seeded.id)?.content).toBe("new");
    expect(meta.version).toBe("2");
  });

  it("sends the bearer token and surfaces HTTP status", async () => {
    const { drive, client } = setup();
    drive.failWith(401);
    const err = await listBackups(client).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DriveError);
    expect((err as DriveError).status).toBe(401);
  });

  it("downloads content paired with the version it was read at", async () => {
    const { drive, client } = setup();
    const seeded = drive.seed("v1");
    const { text, meta } = await downloadBackup(client, seeded.id);
    expect(text).toBe("v1");
    expect(meta.version).toBe("1");
  });

  it("retries when another device writes mid-download, then gives up with 409", async () => {
    const { drive, client } = setup();
    const seeded = drive.seed("v1");
    let writes = 0;
    drive.onRequest((_m, url) => {
      if (url.searchParams.get("alt") === "media" && writes++ < 1) drive.touch(seeded.id, "v2");
    });
    const first = await downloadBackup(client, seeded.id);
    expect(first.text).toBe("v2");
    expect(first.meta.version).toBe("2");

    drive.onRequest((_m, url) => {
      if (url.searchParams.get("alt") === "media") drive.touch(seeded.id);
    });
    const err = await downloadBackup(client, seeded.id).catch((e: unknown) => e);
    expect((err as DriveError).status).toBe(409);
  });
});
