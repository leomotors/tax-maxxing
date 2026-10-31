"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  activeFiling,
  addFiling,
  createLibrary,
  duplicateFiling as duplicateInLibrary,
  normalizeLibrary,
  parseImportJson,
  removeFiling,
  updateFiling,
  type FilingLibrary,
} from "@/lib/filings";
import {
  downloadText,
  exportBackupJson,
  exportProfileJson,
  LIBRARY_KEY,
  loadLibrary,
  readRawLibrary,
  saveLibrary,
  type LoadResult,
} from "@/lib/storage";
import { calculateTax, emptyProfile } from "@/lib/tax/calculate";
import { sanitizeProfile } from "@/lib/tax/sanitize";
import type { TaxProfile } from "@/lib/tax/types";

interface StoreState extends LoadResult {
  saveError?: string;
}

const SERVER_SNAPSHOT: StoreState = { library: createLibrary() };
let clientSnapshot: StoreState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(e: StorageEvent) {
  // Another tab wrote: last writer wins (documented limitation), but stay in sync.
  if (e.key !== null && e.key !== LIBRARY_KEY) return; // null = clear()
  clientSnapshot = loadLibrary();
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getState() {
  if (!clientSnapshot) clientSnapshot = loadLibrary();
  return clientSnapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function getLibrary() {
  return getState().library;
}

/** While blocked, the library is an empty placeholder: never export or upload it. */
export function isStorageBlocked() {
  return Boolean(getState().blocked);
}

const BLOCKED_MESSAGE = "ข้อมูลในเครื่องเสียหาย — กู้คืนหรือเริ่มใหม่ก่อน";

/** Bumped on whole-library replacement so in-flight async writes from before it are dropped. */
let libraryEpoch = 0;

export function getLibraryEpoch() {
  return libraryEpoch;
}

function commit(next: FilingLibrary, opts: { force?: boolean } = {}) {
  const state = getState();
  if (state.blocked && !opts.force) return;
  const library = normalizeLibrary(next);
  const saveError = saveLibrary(library);
  clientSnapshot = { library, saveError };
  emit();
}

function stamp(profile: TaxProfile): TaxProfile {
  return sanitizeProfile({ ...profile, updatedAt: new Date().toISOString() });
}

/** Target a filing by id — async work (e.g. Excel import) must not hit whichever filing is active later. */
export function updateFilingById(
  id: string,
  patch: Partial<TaxProfile> | ((prev: TaxProfile) => TaxProfile),
  epoch?: number,
) {
  if (epoch !== undefined && epoch !== libraryEpoch) return;
  commit(
    updateFiling(getLibrary(), id, (prev) =>
      stamp(typeof patch === "function" ? patch(prev) : { ...prev, ...patch }),
    ),
  );
}

/** Replace every local filing (backup restore / backup import). */
/** Returns the save error, if the replacement could not be persisted. */
export function replaceLibrary(next: FilingLibrary): string | undefined {
  libraryEpoch += 1;
  commit(next, { force: true });
  return getState().saveError;
}

export function useTaxProfile() {
  const state = useSyncExternalStore(subscribe, getState, getServerSnapshot);
  const { library } = state;
  const profile = activeFiling(library);

  const breakdown = useMemo(() => calculateTax(profile), [profile]);

  const setProfile = useCallback(
    (patch: Partial<TaxProfile> | ((prev: TaxProfile) => TaxProfile)) => {
      updateFilingById(activeFiling(getLibrary()).id, patch);
    },
    [],
  );

  const reset = useCallback(() => {
    const id = activeFiling(getLibrary()).id;
    commit(updateFiling(getLibrary(), id, () => ({ ...emptyProfile(), id })));
  }, []);

  const selectFiling = useCallback((id: string) => {
    commit({ ...getLibrary(), activeId: id });
  }, []);

  const createFiling = useCallback(() => commit(addFiling(getLibrary())), []);

  const duplicateFiling = useCallback((id: string) => {
    commit(duplicateInLibrary(getLibrary(), id));
  }, []);

  const deleteFiling = useCallback((id: string) => {
    commit(removeFiling(getLibrary(), id));
  }, []);

  const download = useCallback(() => {
    if (!isStorageBlocked()) exportProfileJson(activeFiling(getLibrary()));
  }, []);

  const downloadBackup = useCallback(() => {
    if (!isStorageBlocked()) exportBackupJson(getLibrary());
  }, []);

  const downloadRawStorage = useCallback(() => {
    const raw = readRawLibrary();
    if (raw) downloadText(raw, "tax-maxxing-raw-storage.json");
  }, []);

  /** Clears an unreadable stored library after the user confirmed. */
  const resetAll = useCallback(() => replaceLibrary(createLibrary()), []);

  /**
   * Single filing → added as a new filing. Backup → `confirmReplace` decides.
   * Throws a Thai message on invalid input.
   */
  const upload = useCallback(
    async (file: File, confirmReplace: (count: number) => boolean) => {
      const parsed = parseImportJson(await file.text());
      if (parsed.kind === "profile") {
        if (isStorageBlocked()) throw new Error(BLOCKED_MESSAGE);
        commit(addFiling(getLibrary(), parsed.profile));
        return;
      }
      if (confirmReplace(parsed.library.filings.length)) {
        replaceLibrary(parsed.library);
      }
    },
    [],
  );

  return {
    profile,
    filings: library.filings,
    activeId: library.activeId,
    storageError: state.error ?? state.saveError,
    storageBlocked: Boolean(state.blocked),
    storageRawAvailable: Boolean(state.rawAvailable),
    setProfile,
    breakdown,
    reset,
    resetAll,
    selectFiling,
    createFiling,
    duplicateFiling,
    deleteFiling,
    download,
    downloadBackup,
    downloadRawStorage,
    upload,
  };
}
