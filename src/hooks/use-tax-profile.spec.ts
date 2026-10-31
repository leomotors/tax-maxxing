import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLibrary } from "@/lib/filings";
import { DRIVE_CACHE_KEY } from "@/lib/google-drive/sync";
import { LIBRARY_KEY } from "@/lib/storage";
import { emptyProfile } from "@/lib/tax/calculate";

function memoryStorage(failWrites = () => false) {
  const data = new Map<string, string>();
  return {
    data,
    storage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failWrites()) throw new DOMException("quota", "QuotaExceededError");
        data.set(k, v);
      },
      removeItem: (k: string) => void data.delete(k),
    } as Storage,
  };
}

// The store is module state: load a fresh copy per test.
async function loadStore() {
  vi.resetModules();
  return import("./use-tax-profile");
}

describe("replaceLibrary", () => {
  let failing = false;
  let mem: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    failing = false;
    mem = memoryStorage(() => failing);
    vi.stubGlobal("localStorage", mem.storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("drops the Drive baseline so the next backup has to ask (reset after corruption)", async () => {
    mem.data.set(LIBRARY_KEY, "{corrupt");
    mem.data.set(DRIVE_CACHE_KEY, JSON.stringify({ fileId: "f", baselineVersion: "3", syncedAt: "x" }));
    const store = await loadStore();
    expect(store.isStorageBlocked()).toBe(true);

    store.replaceLibrary(createLibrary());
    expect(store.isStorageBlocked()).toBe(false);
    expect(mem.data.has(DRIVE_CACHE_KEY)).toBe(false);
  });

  it("another tab's replace bumps this tab's epoch, even when the content is identical", async () => {
    const lib = createLibrary([{ ...emptyProfile(), name: "STOCKA plan" }]);
    mem.data.set(LIBRARY_KEY, JSON.stringify(lib));
    const tabA = await loadStore();
    tabA.getLibrary();
    const tabB = await loadStore(); // separate module copy = separate tab state, shared storage
    tabB.getLibrary();

    // Twice: covers both "no rev yet" and "rev → new rev" for the same content.
    for (let i = 0; i < 2; i++) {
      tabA.replaceLibrary(lib); // identical restore
      const before = tabB.getLibraryEpoch();
      tabB.onStorage({ key: LIBRARY_KEY });
      expect(tabB.getLibraryEpoch()).toBe(before + 1);
    }
  });

  it("a normal edit in another tab does not invalidate this tab's in-flight writes", async () => {
    const tabA = await loadStore();
    tabA.replaceLibrary(createLibrary());
    const tabB = await loadStore();
    const id = tabB.getLibrary().activeId;
    const epoch = tabB.getLibraryEpoch();

    tabA.updateFilingById(id, { name: "edited in A" });
    tabB.onStorage({ key: LIBRARY_KEY });
    expect(tabB.getLibraryEpoch()).toBe(epoch);
    tabB.updateFilingById(id, { name: "STOCKB import" }, epoch);
    expect(tabB.getLibrary().filings[0].name).toBe("STOCKB import");
  });

  it("reports unsaved changes when the replacement can't be persisted", async () => {
    const store = await loadStore();
    failing = true;
    expect(store.replaceLibrary(createLibrary())).toMatch(/localStorage/);
    expect(store.hasUnsavedChanges()).toBe(true);
  });
});
