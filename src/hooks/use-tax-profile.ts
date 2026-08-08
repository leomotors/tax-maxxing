"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { calculateTax, emptyProfile } from "@/lib/tax/calculate";
import type { TaxProfile } from "@/lib/tax/types";
import {
  exportProfileJson,
  loadProfile,
  parseProfileJson,
  saveProfile,
} from "@/lib/storage";

const SERVER_SNAPSHOT = emptyProfile();
let clientSnapshot: TaxProfile | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getClientSnapshot() {
  if (!clientSnapshot) {
    clientSnapshot = loadProfile();
  }
  return clientSnapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function replaceProfile(next: TaxProfile) {
  clientSnapshot = saveProfile(next);
  emit();
}

export function useTaxProfile() {
  const profile = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const breakdown = useMemo(() => calculateTax(profile), [profile]);

  const setProfile = useCallback(
    (patch: Partial<TaxProfile> | ((prev: TaxProfile) => TaxProfile)) => {
      const prev = getClientSnapshot();
      const next =
        typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      replaceProfile(next);
    },
    [],
  );

  const reset = useCallback(() => {
    replaceProfile(emptyProfile(getClientSnapshot().taxYear));
  }, []);

  const download = useCallback(() => {
    exportProfileJson(getClientSnapshot());
  }, []);

  const upload = useCallback(async (file: File) => {
    const text = await file.text();
    replaceProfile(parseProfileJson(text));
  }, []);

  return {
    profile,
    setProfile,
    breakdown,
    reset,
    download,
    upload,
  };
}
