import { emptyProfile } from "@/lib/tax/calculate";
import { parseProfile, ProfileValidationError } from "@/lib/tax/schema";
import type { TaxProfile } from "@/lib/tax/types";

export interface FilingLibrary {
  version: 1;
  activeId: string;
  /** Always at least one filing. */
  filings: TaxProfile[];
}

export interface TaxBackup {
  app: "tax-maxxing";
  kind: "backup";
  version: 1;
  exportedAt: string;
  activeId: string;
  filings: TaxProfile[];
}

export function createLibrary(filings: TaxProfile[] = []): FilingLibrary {
  return normalizeLibrary({ version: 1, activeId: "", filings });
}

/** Ensure ≥1 filing, unique ids and a valid activeId. */
export function normalizeLibrary(lib: FilingLibrary): FilingLibrary {
  const seen = new Set<string>();
  const filings = lib.filings.map((f) => {
    const id = seen.has(f.id) ? crypto.randomUUID() : f.id;
    seen.add(id);
    return id === f.id ? f : { ...f, id };
  });
  if (filings.length === 0) filings.push(emptyProfile());
  const activeId = filings.some((f) => f.id === lib.activeId)
    ? lib.activeId
    : filings[0].id;
  return { version: 1, activeId, filings };
}

export function activeFiling(lib: FilingLibrary): TaxProfile {
  return lib.filings.find((f) => f.id === lib.activeId) ?? lib.filings[0];
}

export function updateFiling(
  lib: FilingLibrary,
  id: string,
  fn: (prev: TaxProfile) => TaxProfile,
): FilingLibrary {
  return {
    ...lib,
    filings: lib.filings.map((f) => (f.id === id ? { ...fn(f), id } : f)),
  };
}

export function addFiling(lib: FilingLibrary, filing = emptyProfile()): FilingLibrary {
  const fresh = { ...filing, id: crypto.randomUUID() };
  return { ...lib, activeId: fresh.id, filings: [...lib.filings, fresh] };
}

export function duplicateFiling(lib: FilingLibrary, id: string): FilingLibrary {
  const source = lib.filings.find((f) => f.id === id);
  if (!source) return lib;
  const copy = structuredClone(source);
  copy.name = source.name ? `${source.name} (สำเนา)` : "สำเนา";
  return addFiling(lib, copy);
}

export function removeFiling(lib: FilingLibrary, id: string): FilingLibrary {
  return normalizeLibrary({
    ...lib,
    filings: lib.filings.filter((f) => f.id !== id),
  });
}

export function toBackup(lib: FilingLibrary): TaxBackup {
  return {
    app: "tax-maxxing",
    kind: "backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    activeId: lib.activeId,
    filings: lib.filings,
  };
}

function isBackupShape(value: unknown): value is { filings: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { app?: unknown }).app === "tax-maxxing" &&
    (value as { kind?: unknown }).kind === "backup"
  );
}

/** Parse a backup envelope; rejects the whole backup if any filing is invalid. */
export function parseBackup(value: unknown): FilingLibrary {
  if (!isBackupShape(value) || (value as { version?: unknown }).version !== 1) {
    throw new ProfileValidationError("ไฟล์สำรองไม่รองรับ (ต้องการ version: 1)");
  }
  const raw = (value as { filings: unknown; activeId?: unknown });
  if (!Array.isArray(raw.filings) || raw.filings.length === 0) {
    throw new ProfileValidationError("ไฟล์สำรองไม่มีรายการยื่นภาษี");
  }
  const filings = raw.filings.map((f, i) => {
    try {
      return parseProfile(f);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      throw new ProfileValidationError(`รายการที่ ${i + 1}: ${reason}`);
    }
  });
  return normalizeLibrary({
    version: 1,
    activeId: typeof raw.activeId === "string" ? raw.activeId : "",
    filings,
  });
}

export type ParsedImport =
  | { kind: "backup"; library: FilingLibrary }
  | { kind: "profile"; profile: TaxProfile };

/** Accepts either a full backup or a single-filing JSON (the per-filing download). */
export function parseImportJson(text: string): ParsedImport {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ProfileValidationError("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง");
  }
  if (isBackupShape(value)) return { kind: "backup", library: parseBackup(value) };
  return { kind: "profile", profile: parseProfile(value) };
}
