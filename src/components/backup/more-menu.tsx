"use client";

import { useRef, useState } from "react";
import { Download, MoreHorizontal, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDismiss } from "@/hooks/use-dismiss";

const MENU_ITEM =
  "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-2 transition hover:bg-accent-soft hover:text-accent";

/** Low-priority per-file JSON actions, kept out of the header's main row. */
export function MoreMenu({
  onLoadJson,
  onSaveFilingJson,
  saveDisabled,
}: {
  onLoadJson: () => void;
  onSaveFilingJson: () => void;
  saveDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, () => setOpen(false));

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className="px-2"
        title="เพิ่มเติม"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">เพิ่มเติม</span>
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 rounded-[var(--radius-lg)] border border-line bg-surface p-1.5 shadow-lg"
        >
          <button type="button" role="menuitem" className={MENU_ITEM} onClick={run(onLoadJson)}>
            <Upload className="mt-0.5 size-4 shrink-0" />
            <span>
              โหลด JSON
              <span className="block text-xs text-ink-3">รายการเดียว หรือไฟล์สำรองทั้งหมด</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${MENU_ITEM} disabled:pointer-events-none disabled:opacity-40`}
            disabled={saveDisabled}
            onClick={run(onSaveFilingJson)}
          >
            <Download className="mt-0.5 size-4 shrink-0" />
            <span>
              บันทึก JSON
              <span className="block text-xs text-ink-3">เฉพาะรายการนี้</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
