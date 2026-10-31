"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloudDownload, CloudUpload, LogOut } from "lucide-react";

import { GoogleDriveLogo } from "@/components/backup/google-drive-logo";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/hooks/use-dismiss";
import { useDriveBackup, type DriveDialog } from "@/hooks/use-drive-backup";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export function DriveMenu({
  onDownloadLocal,
  storageBlocked,
}: {
  onDownloadLocal: () => void;
  storageBlocked: boolean;
}) {
  const drive = useDriveBackup();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Dialogs are portalled outside rootRef: keep the popover (and its result message) while one is open.
  useDismiss(rootRef, open && !drive.dialog, () => setOpen(false));

  if (!drive.available) return null;
  const disabled = !drive.ready;

  return (
    <div ref={rootRef} className="relative">
      <Button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <GoogleDriveLogo className="size-4" />
        Google Drive
      </Button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 space-y-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4 shadow-lg">
          <p className="text-xs text-ink-3">
            สำรองทุกรายการ (รวมรายละเอียดเงินปันผลที่นำเข้า) เป็นไฟล์เดียวใน Google Drive ของคุณ
            — แอปเข้าถึงได้เฉพาะไฟล์ที่แอปสร้างเอง
          </p>
          <p className="rounded-[var(--radius)] border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-ink-2">
            <strong className="font-semibold text-ink">ใช้ได้เฉพาะบัญชีที่ผู้พัฒนาเพิ่มเป็นผู้ทดสอบ</strong>
            {" "}— แอปนี้ไม่ได้ส่งให้ Google ตรวจสอบและไม่มีแผนจะส่ง ผู้ใช้อื่นจะเข้าสู่ระบบไม่ได้
            (Google แจ้ง “Access blocked”) ให้ใช้ “บันทึกทั้งหมด” / “โหลด JSON” แทน
            หรือ deploy เองพร้อม Client ID ของคุณ
          </p>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={disabled || storageBlocked}
              onClick={drive.backup}
            >
              <CloudUpload className="size-4" />
              สำรองไป Drive
            </Button>
            <Button type="button" disabled={disabled} onClick={drive.restore}>
              <CloudDownload className="size-4" />
              กู้คืนจาก Drive
            </Button>
          </div>
          <p className="text-xs text-ink-3">
            {drive.busy
              ? "กำลังดำเนินการ…"
              : drive.syncedAt
                ? `ซิงก์ล่าสุด ${formatTime(drive.syncedAt)}`
                : "ยังไม่เคยซิงก์บนเครื่องนี้"}
          </p>
          {drive.error && <p className="text-xs text-danger">{drive.error}</p>}
          {drive.notice && <p className="text-xs text-mint">{drive.notice}</p>}
          {(drive.connected || drive.syncedAt) && (
            <Button type="button" variant="ghost" className="w-full" onClick={drive.disconnect}>
              <LogOut className="size-4" />
              ตัดการเชื่อมต่อ
            </Button>
          )}
        </div>
      )}

      {/* Portal: the header's backdrop-filter would otherwise trap `fixed` inside the header. */}
      {drive.dialog &&
        createPortal(
          <DriveDialogView dialog={drive.dialog} onDownloadLocal={onDownloadLocal} />,
          document.body,
        )}
    </div>
  );
}

function DriveDialogView({
  dialog,
  onDownloadLocal,
}: {
  dialog: DriveDialog;
  onDownloadLocal: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/30 p-4" role="dialog" aria-modal="true" aria-labelledby="drive-dialog-title">
      <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-xl">
        {dialog.kind === "pick" && (
          <>
            <h2 id="drive-dialog-title" className="font-semibold">พบไฟล์สำรองหลายไฟล์</h2>
            <p className="text-sm text-ink-2">เลือกไฟล์ที่จะใช้</p>
            <div className="grid gap-2">
              {dialog.files.map((f) => (
                <Button key={f.id} type="button" className="h-auto whitespace-normal text-left" onClick={() => dialog.resolve(f)}>
                  {f.name} · แก้ไข {formatTime(f.modifiedTime)}
                </Button>
              ))}
            </div>
            <Button type="button" variant="ghost" className="w-full" autoFocus onClick={() => dialog.resolve(null)}>
              ยกเลิก
            </Button>
          </>
        )}

        {dialog.kind === "conflict" && (
          <>
            <h2 id="drive-dialog-title" className="font-semibold">
              {dialog.reason === "changed"
                ? "ไฟล์บน Drive ถูกแก้ไขจากที่อื่น"
                : "มีไฟล์สำรองบน Drive อยู่แล้ว"}
            </h2>
            <p className="text-sm text-ink-2">
              แก้ไขล่าสุด {formatTime(dialog.file.modifiedTime)} — เขียนทับจะแทนที่ข้อมูลบน Drive
              ด้วยข้อมูลในเครื่องนี้ทั้งหมด
            </p>
            <div className="grid gap-2">
              <Button type="button" onClick={() => dialog.resolve("restore")}>
                กู้คืนจาก Drive แทน
              </Button>
              <Button type="button" variant="danger" onClick={() => dialog.resolve("overwrite")}>
                เขียนทับ Drive
              </Button>
              <Button type="button" variant="ghost" autoFocus onClick={() => dialog.resolve("cancel")}>
                ยกเลิก
              </Button>
            </div>
          </>
        )}

        {dialog.kind === "confirm-restore" && (
          <>
            <h2 id="drive-dialog-title" className="font-semibold">กู้คืนจาก Google Drive?</h2>
            <p className="text-sm text-ink-2">
              แทนที่ {dialog.localCount} รายการในเครื่องด้วย {dialog.remoteCount} รายการจาก Drive
              {dialog.editedMeanwhile && " (มีการแก้ไขในเครื่องระหว่างดาวน์โหลด)"}
            </p>
            <div className="grid gap-2">
              <Button type="button" onClick={onDownloadLocal}>
                ดาวน์โหลดข้อมูลในเครื่องเก็บไว้ก่อน
              </Button>
              <Button type="button" variant="danger" onClick={() => dialog.resolve(true)}>
                กู้คืน
              </Button>
              <Button type="button" variant="ghost" autoFocus onClick={() => dialog.resolve(false)}>
                ยกเลิก
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
