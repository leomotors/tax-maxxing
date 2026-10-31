import {
  createLibrary,
  normalizeLibrary,
  parseBackup,
  toBackup,
  type FilingLibrary,
} from "@/lib/filings";
import { parseProfile } from "@/lib/tax/schema";
import type { TaxProfile } from "@/lib/tax/types";

export const LIBRARY_KEY = "tax-maxxing:filings:v1";
/** Pre-multi-filing single profile; left intact after migration as a fallback. */
const LEGACY_PROFILE_KEY = "tax-maxxing:profile:v1";

export interface LoadResult {
  library: FilingLibrary;
  /** Thai message shown in a banner. */
  error?: string;
  /**
   * Stored library exists but can't be read: writes are blocked so it is never
   * overwritten until the user explicitly resets.
   */
  blocked?: boolean;
  /** Unreadable data is still in storage; offer a raw download. */
  rawAvailable?: boolean;
}

// Resolved inside try: the `localStorage` getter itself throws when storage is denied.
function resolve(storage?: Storage) {
  return storage ?? localStorage;
}

function readLibrary(raw: string): FilingLibrary {
  const parsed = JSON.parse(raw) as { version?: unknown; activeId?: unknown; filings?: unknown };
  // Same validation as a backup file; the stored shape only lacks the envelope.
  return parseBackup({ ...parsed, app: "tax-maxxing", kind: "backup" });
}

export function loadLibrary(storage?: Storage): LoadResult {
  let raw: string | null;
  let store: Storage;
  try {
    store = resolve(storage);
    raw = store.getItem(LIBRARY_KEY);
  } catch {
    return {
      library: createLibrary(),
      error: "เบราว์เซอร์ไม่อนุญาตให้อ่าน localStorage — ข้อมูลจะไม่ถูกบันทึก",
      blocked: true,
    };
  }

  if (raw !== null) {
    try {
      return { library: readLibrary(raw) };
    } catch {
      return {
        library: createLibrary(),
        error: "ข้อมูลที่บันทึกไว้เสียหายหรือไม่รองรับ — ดาวน์โหลดข้อมูลดิบเก็บไว้ก่อนล้าง",
        blocked: true,
        rawAvailable: true,
      };
    }
  }

  let legacy: TaxProfile | null = null;
  try {
    const legacyRaw = store.getItem(LEGACY_PROFILE_KEY);
    if (legacyRaw) legacy = parseProfile(JSON.parse(legacyRaw));
  } catch {
    // Legacy key stays untouched (never written), so it can still be downloaded later.
    return {
      library: createLibrary(),
      error: "ย้ายข้อมูลเดิมไม่สำเร็จ (รูปแบบไม่ถูกต้อง) — ดาวน์โหลดข้อมูลดิบเก็บไว้ก่อนเริ่มใหม่",
      blocked: true,
      rawAvailable: true,
    };
  }

  const library = createLibrary(legacy ? [legacy] : []);
  if (!legacy) return { library };
  try {
    store.setItem(LIBRARY_KEY, JSON.stringify(library));
    return { library };
  } catch {
    return { library, error: "ย้ายข้อมูลเดิมไม่สำเร็จ — การแก้ไขอาจไม่ถูกบันทึก" };
  }
}

/** Returns an error message instead of throwing (quota / privacy mode). */
export function saveLibrary(
  library: FilingLibrary,
  storage?: Storage,
): string | undefined {
  try {
    resolve(storage).setItem(LIBRARY_KEY, JSON.stringify(normalizeLibrary(library)));
    return undefined;
  } catch {
    return "บันทึกลง localStorage ไม่สำเร็จ (พื้นที่เต็มหรือถูกปิดกั้น)";
  }
}

/** Raw library, or the unmigrated legacy profile when there is no library yet. */
export function readRawLibrary(storage?: Storage): string | null {
  try {
    const store = resolve(storage);
    return store.getItem(LIBRARY_KEY) ?? store.getItem(LEGACY_PROFILE_KEY);
  } catch {
    return null;
  }
}

function filenameSlug(name: string) {
  const slug = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "tax-maxxing";
}

export function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportProfileJson(profile: TaxProfile) {
  downloadText(JSON.stringify(profile, null, 2), `${filenameSlug(profile.name)}.json`);
}

export function exportBackupJson(library: FilingLibrary) {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(
    JSON.stringify(toBackup(library), null, 2),
    `tax-maxxing-backup-${date}.json`,
  );
}
