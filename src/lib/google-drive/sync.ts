import {
  createBackup,
  downloadBackup,
  listBackups,
  updateBackup,
  type DriveClient,
  type DriveFile,
} from "@/lib/google-drive/api";

export const DRIVE_CACHE_KEY = "tax-maxxing:drive:v1";

/**
 * Last Drive state this browser wrote or restored. File ids are global, so a
 * different Google account never matches `fileId` and gets no baseline.
 */
export interface DriveCache {
  fileId: string;
  baselineVersion: string;
  syncedAt: string;
}

export function readDriveCache(storage?: Storage): DriveCache | null {
  try {
    const raw = (storage ?? localStorage).getItem(DRIVE_CACHE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<DriveCache>) : null;
    return v && typeof v.fileId === "string" && typeof v.baselineVersion === "string"
      ? (v as DriveCache)
      : null;
  } catch {
    return null;
  }
}

export function writeDriveCache(meta: DriveFile, storage?: Storage): DriveCache {
  const cache = { fileId: meta.id, baselineVersion: meta.version, syncedAt: new Date().toISOString() };
  try {
    (storage ?? localStorage).setItem(DRIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Non-fatal: next backup just asks for confirmation again.
  }
  return cache;
}

export function clearDriveCache(storage?: Storage) {
  try {
    (storage ?? localStorage).removeItem(DRIVE_CACHE_KEY);
  } catch {
    // ignore
  }
}

export type ConflictReason = "unknown" | "changed";
export type ConflictChoice = "overwrite" | "restore" | "cancel";

export interface SyncDeps {
  client: DriveClient;
  cache: DriveCache | null;
  /** Throws if the session ended (disconnect); called before each Drive write/read. */
  checkActive?: () => void;
  pickFile: (files: DriveFile[]) => Promise<DriveFile | null>;
  resolveConflict: (reason: ConflictReason, file: DriveFile) => Promise<ConflictChoice>;
}

/** Re-discovered every run; the cache only selects among found files and supplies the baseline. */
async function resolveTarget(deps: SyncDeps): Promise<DriveFile | null | "cancel"> {
  const files = await listBackups(deps.client);
  deps.checkActive?.();
  const cached = files.find((f) => f.id === deps.cache?.fileId);
  if (cached) return cached;
  if (files.length <= 1) return files[0] ?? null;
  return (await deps.pickFile(files)) ?? "cancel";
}

export type BackupResult =
  | { status: "saved"; meta: DriveFile }
  | { status: "cancelled" }
  | { status: "restore-requested" };

/** `content` is called right before the write so it reflects edits made during dialogs. */
export async function runBackup(deps: SyncDeps, content: () => string): Promise<BackupResult> {
  const target = await resolveTarget(deps);
  deps.checkActive?.();
  if (target === "cancel") return { status: "cancelled" };
  if (!target) return { status: "saved", meta: await createBackup(deps.client, content()) };

  const baseline = deps.cache?.fileId === target.id ? deps.cache.baselineVersion : null;
  if (baseline !== target.version) {
    const choice = await deps.resolveConflict(baseline ? "changed" : "unknown", target);
    if (choice === "cancel") return { status: "cancelled" };
    if (choice === "restore") return { status: "restore-requested" };
    deps.checkActive?.();
  }
  // Not atomic: a write landing between the check and this PATCH is overwritten (accepted).
  return { status: "saved", meta: await updateBackup(deps.client, target.id, content()) };
}

export type RestoreResult =
  | { status: "none" }
  | { status: "cancelled" }
  | { status: "downloaded"; text: string; meta: DriveFile };

/** Never creates a file. */
export async function runRestore(deps: SyncDeps): Promise<RestoreResult> {
  const target = await resolveTarget(deps);
  deps.checkActive?.();
  if (target === "cancel") return { status: "cancelled" };
  if (!target) return { status: "none" };
  const { text, meta } = await downloadBackup(deps.client, target.id);
  return { status: "downloaded", text, meta };
}
