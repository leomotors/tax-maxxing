"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLibrary,
  getLibraryEpoch,
  hasUnsavedChanges,
  isStorageBlocked,
  replaceLibrary,
} from "@/hooks/use-tax-profile";
import { parseBackup, toBackup, type FilingLibrary } from "@/lib/filings";
import { DriveError, type DriveFile } from "@/lib/google-drive/api";
import {
  createTokenRequester,
  GOOGLE_CLIENT_ID,
  isSessionValid,
  loadGis,
  type DriveSession,
} from "@/lib/google-drive/auth";
import {
  clearDriveCache,
  readDriveCache,
  runBackup,
  runRestore,
  writeDriveCache,
  type ConflictChoice,
  type ConflictReason,
  type SyncDeps,
} from "@/lib/google-drive/sync";

export type DriveDialog =
  | { kind: "pick"; files: DriveFile[]; resolve: (f: DriveFile | null) => void }
  | {
      kind: "conflict";
      reason: ConflictReason;
      file: DriveFile;
      resolve: (c: ConflictChoice) => void;
    }
  | {
      kind: "confirm-restore";
      localCount: number;
      remoteCount: number;
      editedMeanwhile: boolean;
      resolve: (ok: boolean) => void;
    };

type Status = "loading" | "ready" | "busy" | "unavailable";

class Stale extends Error {}

const BLOCKED_BACKUP = "ข้อมูลในเครื่องเสียหาย — สำรองไม่ได้ (กู้คืนจาก Drive ได้)";
const REPLACED_DURING_BACKUP = "ข้อมูลในเครื่องถูกแทนที่ระหว่างสำรอง — กดสำรองอีกครั้ง";

export function useDriveBackup() {
  const [status, setStatus] = useState<Status>(GOOGLE_CLIENT_ID ? "loading" : "unavailable");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [dialog, setDialog] = useState<DriveDialog | null>(null);

  const requester = useRef<ReturnType<typeof createTokenRequester> | null>(null);
  const session = useRef<DriveSession | null>(null);
  // Bumped on disconnect so callbacks from an older session can't touch state.
  const generation = useRef(0);
  const busy = useRef(false);
  // Bumped by every action so a late revoke result can't overwrite a newer message.
  const action = useRef(0);
  const cancelDialog = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then((oauth2) => {
        if (cancelled) return;
        setSyncedAt(readDriveCache()?.syncedAt ?? null);
        requester.current = createTokenRequester(oauth2, GOOGLE_CLIENT_ID);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** `cancelValue` settles the dialog if the user disconnects while it is open. */
  function ask<T>(make: (resolve: (v: T) => void) => DriveDialog, cancelValue: T): Promise<T> {
    return new Promise<T>((resolve) => {
      const settle = (v: T) => {
        cancelDialog.current = null;
        setDialog(null);
        resolve(v);
      };
      cancelDialog.current = () => settle(cancelValue);
      setDialog(make(settle));
    });
  }

  /** Synchronous up to `requestToken()` — call before any `await` in a click handler. */
  function ensureSession(gen: number): Promise<DriveSession> {
    if (isSessionValid(session.current)) return Promise.resolve(session.current!);
    if (!requester.current) return Promise.reject(new Error("Google Sign-In ยังไม่พร้อม"));
    return requester.current.requestToken().then((s) => {
      // Authorization finished after a disconnect: don't resurrect the session.
      if (generation.current !== gen) throw new Stale();
      session.current = s;
      setConnected(true);
      return s;
    });
  }

  function deps(s: DriveSession, checkStale: () => void): SyncDeps {
    return {
      client: { token: s.token },
      cache: readDriveCache(),
      checkActive: checkStale,
      pickFile: (files) =>
        ask<DriveFile | null>((resolve) => ({ kind: "pick", files, resolve }), null),
      resolveConflict: (reason, file) =>
        ask<ConflictChoice>((resolve) => ({ kind: "conflict", reason, file, resolve }), "cancel"),
    };
  }

  async function applyRestore(s: DriveSession, gen: number, checkStale: () => void) {
    const before = getLibrary();
    const result = await runRestore(deps(s, checkStale));
    checkStale();
    if (result.status === "none") {
      setError("ไม่พบไฟล์สำรองของ Tax-Maxxing บน Google Drive นี้");
      return;
    }
    if (result.status === "cancelled") return;

    let library: FilingLibrary;
    try {
      library = parseBackup(JSON.parse(result.text));
    } catch (err) {
      setError(`ไฟล์บน Drive ใช้ไม่ได้: ${err instanceof Error ? err.message : ""}`);
      return;
    }
    // Re-ask if local data changed while the dialog was open (e.g. an Excel import finished).
    let shown = before;
    for (;;) {
      const current = getLibrary();
      const ok = await ask<boolean>(
        (resolve) => ({
          kind: "confirm-restore",
          localCount: current.filings.length,
          remoteCount: library.filings.length,
          editedMeanwhile: current !== shown,
          resolve,
        }),
        false,
      );
      checkStale();
      if (!ok) return;
      if (getLibrary() === current) break;
      shown = current;
    }
    const saveError = replaceLibrary(library);
    if (saveError) {
      // Not persisted: a baseline would let the next backup overwrite Drive without asking.
      setError(saveError);
      return;
    }
    setSyncedAt(writeDriveCache(result.meta).syncedAt);
    setNotice(`กู้คืน ${library.filings.length} รายการจาก Google Drive แล้ว`);
  }

  async function run(op: (s: DriveSession, gen: number, checkStale: () => void) => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    action.current += 1;
    const gen = generation.current;
    const checkStale = () => {
      if (generation.current !== gen) throw new Stale();
    };
    setError(null);
    setNotice(null);
    setStatus("busy");
    try {
      const s = await ensureSession(gen);
      checkStale();
      await op(s, gen, checkStale);
    } catch (err) {
      // Errors from a disconnected run must not touch the current session.
      if (err instanceof Stale || generation.current !== gen) return;
      if (err instanceof DriveError && err.status === 401) {
        session.current = null;
        setConnected(false);
        setError("เซสชัน Google หมดอายุ — กดอีกครั้งเพื่อเข้าสู่ระบบ");
      } else {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    } finally {
      // A stale run must not release the lock held by a newer one.
      if (generation.current === gen) {
        busy.current = false;
        setStatus("ready");
      }
    }
  }

  const backup = () => {
    if (isStorageBlocked()) {
      action.current += 1;
      setError(BLOCKED_BACKUP);
      return;
    }
    // A library replace after this click makes the baseline deps() reads stale.
    const epoch = getLibraryEpoch();
    return run(async (s, gen, checkStale) => {
      const result = await runBackup(deps(s, checkStale), () => {
        // Storage can become blocked while the popup/dialogs are open.
        if (isStorageBlocked()) throw new Error(BLOCKED_BACKUP);
        if (getLibraryEpoch() !== epoch) throw new Error(REPLACED_DURING_BACKUP);
        return JSON.stringify(toBackup(getLibrary()), null, 2);
      });
      checkStale();
      if (result.status === "saved") {
        // A baseline is only safe if the uploaded library is also what storage holds.
        if (getLibraryEpoch() === epoch && !hasUnsavedChanges()) {
          setSyncedAt(writeDriveCache(result.meta).syncedAt);
          setNotice("สำรองไป Google Drive แล้ว");
        } else {
          clearDriveCache();
          setSyncedAt(null);
          setNotice("สำรองไป Google Drive แล้ว แต่ข้อมูลในเครื่องไม่ตรงกับไฟล์บน Drive — ครั้งหน้าจะถามก่อนเขียนทับ");
        }
      } else if (result.status === "restore-requested") {
        await applyRestore(s, gen, checkStale);
      }
    });
  };

  const restore = () => run(applyRestore);

  const disconnect = useCallback(() => {
    generation.current += 1;
    busy.current = false;
    cancelDialog.current?.();
    const token = session.current?.token;
    session.current = null;
    clearDriveCache();
    setConnected(false);
    setSyncedAt(null);
    setDialog(null);
    setError(null);
    setNotice("ตัดการเชื่อมต่อ Google Drive แล้ว");
    if (requester.current) setStatus("ready");
    const seq = ++action.current;
    if (token) {
      void requester.current?.revoke(token).then((ok) => {
        if (!ok && action.current === seq) setError("ยกเลิกสิทธิ์กับ Google ไม่สำเร็จ — ถอนสิทธิ์เองได้ที่ myaccount.google.com/permissions");
      });
    }
  }, []);

  return {
    available: Boolean(GOOGLE_CLIENT_ID),
    ready: status === "ready",
    busy: status === "busy",
    connected,
    error,
    notice,
    syncedAt,
    dialog,
    backup,
    restore,
    disconnect,
  };
}
