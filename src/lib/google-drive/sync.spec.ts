import { describe, expect, it, vi } from "vitest";

import { createFakeDrive } from "./fake-drive.test-util";
import { runBackup, runRestore, type DriveCache, type SyncDeps } from "./sync";

function setup(overrides: Partial<SyncDeps> = {}) {
  const drive = createFakeDrive();
  const deps: SyncDeps = {
    client: { token: "test-token", fetch: drive.fetch },
    cache: null,
    pickFile: vi.fn(async () => null),
    resolveConflict: vi.fn(async () => "cancel" as const),
    ...overrides,
  };
  return { drive, deps };
}

const cacheFor = (fileId: string, baselineVersion: string): DriveCache => ({
  fileId,
  baselineVersion,
  syncedAt: "2026-01-01T00:00:00.000Z",
});

describe("runBackup", () => {
  it("creates the file when none exists, without prompting", async () => {
    const { drive, deps } = setup();
    const result = await runBackup(deps, () => "content");
    expect(result.status).toBe("saved");
    expect(drive.files.size).toBe(1);
    expect(deps.resolveConflict).not.toHaveBeenCalled();
  });

  it("overwrites silently when the baseline matches", async () => {
    const { drive, deps } = setup();
    const file = drive.seed("old");
    deps.cache = cacheFor(file.id, "1");
    const result = await runBackup(deps, () => "new");
    expect(result).toMatchObject({ status: "saved", meta: { version: "2" } });
    expect(deps.resolveConflict).not.toHaveBeenCalled();
  });

  it("asks (reason unknown) when a backup exists but this browser has no baseline", async () => {
    const { drive, deps } = setup();
    drive.seed("remote");
    const result = await runBackup(deps, () => "local");
    expect(deps.resolveConflict).toHaveBeenCalledWith("unknown", expect.anything());
    expect(result.status).toBe("cancelled");
    expect([...drive.files.values()][0].content).toBe("remote");
  });

  it("asks (reason changed) when Drive moved past the baseline; overwrite proceeds", async () => {
    const { drive, deps } = setup({ resolveConflict: vi.fn(async () => "overwrite" as const) });
    const file = drive.seed("v1");
    deps.cache = cacheFor(file.id, "1");
    drive.touch(file.id, "from another device");
    const result = await runBackup(deps, () => "local");
    expect(deps.resolveConflict).toHaveBeenCalledWith("changed", expect.anything());
    expect(result.status).toBe("saved");
    expect(drive.files.get(file.id)?.content).toBe("local");
  });

  it("returns restore-requested without writing", async () => {
    const { drive, deps } = setup({ resolveConflict: vi.fn(async () => "restore" as const) });
    drive.seed("remote");
    expect((await runBackup(deps, () => "local")).status).toBe("restore-requested");
    expect(drive.requests.some((r) => r.method !== "GET")).toBe(false);
  });

  it("treats another account's cached file id as no baseline", async () => {
    const { drive, deps } = setup();
    drive.seed("this account");
    deps.cache = cacheFor("file-from-other-account", "1");
    await runBackup(deps, () => "local");
    expect(deps.resolveConflict).toHaveBeenCalledWith("unknown", expect.anything());
  });

  it("asks which file when several exist, preferring the cached one otherwise", async () => {
    const { drive, deps } = setup();
    const a = drive.seed("a");
    const b = drive.seed("b");
    await runBackup(deps, () => "x");
    expect(deps.pickFile).toHaveBeenCalledTimes(1);

    deps.cache = cacheFor(b.id, "1");
    const result = await runBackup(deps, () => "x");
    expect(deps.pickFile).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "saved", meta: { id: b.id } });
    expect(drive.files.get(a.id)?.content).toBe("a");
  });

  it("reads content lazily, right before the write", async () => {
    const { deps } = setup();
    const content = vi.fn(() => "late");
    await runBackup(deps, content);
    expect(content).toHaveBeenCalledTimes(1);
  });

  it("stops before writing once the session is no longer active", async () => {
    const { drive, deps } = setup({
      checkActive: () => {
        throw new Error("stale");
      },
    });
    await expect(runBackup(deps, () => "x")).rejects.toThrow("stale");
    expect(drive.files.size).toBe(0);
  });
});

describe("runRestore", () => {
  it("never creates a file", async () => {
    const { drive, deps } = setup();
    expect((await runRestore(deps)).status).toBe("none");
    expect(drive.requests.every((r) => r.method === "GET")).toBe(true);
  });

  it("downloads the target with its version", async () => {
    const { drive, deps } = setup();
    drive.seed("payload");
    const result = await runRestore(deps);
    expect(result).toMatchObject({ status: "downloaded", text: "payload", meta: { version: "1" } });
  });

  it("cancels when the user dismisses the file picker", async () => {
    const { drive, deps } = setup();
    drive.seed("a");
    drive.seed("b");
    expect((await runRestore(deps)).status).toBe("cancelled");
  });

  it("does not open a picker for a stale (disconnected) run", async () => {
    const { drive, deps } = setup({
      checkActive: () => {
        throw new Error("stale");
      },
    });
    drive.seed("a");
    drive.seed("b");
    await expect(runRestore(deps)).rejects.toThrow("stale");
    expect(deps.pickFile).not.toHaveBeenCalled();
  });
});
