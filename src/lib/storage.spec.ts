import { describe, expect, it } from "vitest";

import { createLibrary } from "./filings";
import { LIBRARY_KEY, loadLibrary, readRawLibrary, saveLibrary } from "./storage";
import { emptyProfile } from "./tax/calculate";

const LEGACY_KEY = "tax-maxxing:profile:v1";

function memoryStorage(init: Record<string, string> = {}, opts: { failWrites?: boolean } = {}) {
  const data = new Map(Object.entries(init));
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new DOMException("quota", "QuotaExceededError");
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
  return { storage, data };
}

function legacyProfile(overrides: Record<string, unknown> = {}) {
  const legacy: Record<string, unknown> = { ...emptyProfile(), name: "demo-legacy", ...overrides };
  delete legacy.id; // the old app had no ids
  return JSON.stringify(legacy);
}

describe("loadLibrary", () => {
  it("starts empty when nothing is stored", () => {
    const { storage, data } = memoryStorage();
    const result = loadLibrary(storage);
    expect(result.library.filings).toHaveLength(1);
    expect(result.blocked).toBeFalsy();
    expect(data.has(LIBRARY_KEY)).toBe(false);
  });

  it("migrates the legacy profile, persists it and keeps the legacy key", () => {
    const { storage, data } = memoryStorage({ [LEGACY_KEY]: legacyProfile() });
    const result = loadLibrary(storage);
    expect(result.error).toBeUndefined();
    expect(result.library.filings[0].name).toBe("demo-legacy");
    expect(data.has(LIBRARY_KEY)).toBe(true);
    expect(data.has(LEGACY_KEY)).toBe(true);

    // Idempotent: the second load reads the new key with the same id.
    const again = loadLibrary(storage);
    expect(again.library.filings[0].id).toBe(result.library.filings[0].id);
  });

  it("migrates legacy numeric junk written by the old app", () => {
    const p = emptyProfile();
    const raw = legacyProfile({ personal: { ...p.personal, children: 1.5, ownParents: null } });
    const result = loadLibrary(memoryStorage({ [LEGACY_KEY]: raw }).storage);
    expect(result.blocked).toBeFalsy();
    expect(result.library.filings[0].personal.children).toBe(1);
  });

  it("keeps working in memory when the migration write fails", () => {
    const { storage } = memoryStorage({ [LEGACY_KEY]: legacyProfile() }, { failWrites: true });
    const result = loadLibrary(storage);
    expect(result.library.filings[0].name).toBe("demo-legacy");
    expect(result.error).toBeDefined();
    expect(result.blocked).toBeFalsy();
  });

  it("blocks (with raw download) on unreadable legacy data instead of dropping it", () => {
    const { storage, data } = memoryStorage({ [LEGACY_KEY]: "{broken" });
    const result = loadLibrary(storage);
    expect(result.blocked).toBe(true);
    expect(result.rawAvailable).toBe(true);
    expect(data.has(LIBRARY_KEY)).toBe(false);
    expect(readRawLibrary(storage)).toBe("{broken");
  });

  it("blocks on a corrupt library and never falls back to the legacy profile", () => {
    const corrupt = JSON.stringify({ version: 1, filings: [{ version: 1, id: "x", income401: "oops" }] });
    const { storage, data } = memoryStorage({ [LIBRARY_KEY]: corrupt, [LEGACY_KEY]: legacyProfile() });
    const result = loadLibrary(storage);
    expect(result.blocked).toBe(true);
    expect(result.rawAvailable).toBe(true);
    expect(result.library.filings[0].name).toBe("");
    expect(data.get(LIBRARY_KEY)).toBe(corrupt);
  });

  it("blocks without crashing when storage access is denied", () => {
    const denied = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    } as unknown as Storage;
    const result = loadLibrary(denied);
    expect(result.blocked).toBe(true);
    expect(result.rawAvailable).toBeFalsy();
  });
});

describe("saveLibrary", () => {
  it("returns an error message instead of throwing on quota errors", () => {
    const { storage } = memoryStorage({}, { failWrites: true });
    expect(saveLibrary(createLibrary(), storage)).toMatch(/localStorage/);
  });

  it("persists a library that loads back", () => {
    const { storage } = memoryStorage();
    const lib = createLibrary([{ ...emptyProfile(), name: "STOCKA plan" }]);
    expect(saveLibrary(lib, storage)).toBeUndefined();
    expect(loadLibrary(storage).library.filings[0].name).toBe("STOCKA plan");
  });
});
