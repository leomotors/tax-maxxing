"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Copy, FilePlus2, Trash2 } from "lucide-react";

import { useDismiss } from "@/hooks/use-dismiss";
import type { TaxProfile } from "@/lib/tax/types";
import { cn } from "@/lib/utils";

function filingLabel(filing: TaxProfile, index: number) {
  return filing.name.trim() || `รายการที่ ${index + 1} (ไม่มีชื่อ)`;
}

const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-2 transition hover:bg-accent-soft hover:text-accent";

/** Name field of the active filing (renames it) + dropdown to switch / add / duplicate / delete. */
export function FilingSwitcher({
  filings,
  activeId,
  onRename,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
}: {
  filings: TaxProfile[];
  activeId: string;
  onRename: (name: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, filings.findIndex((f) => f.id === activeId));
  const active = filings[index];

  useDismiss(rootRef, open, () => setOpen(false));

  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative min-w-[12rem] flex-1 sm:max-w-[18rem] sm:flex-none">
      <div className="flex items-center rounded-[var(--radius)] border border-line bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <label className="min-w-0 flex-1">
          <span className="sr-only">ชื่อรายการยื่นภาษี</span>
          <input
            type="text"
            value={active?.name ?? ""}
            placeholder={active ? filingLabel(active, index) : "ชื่อรายการ"}
            className="w-full bg-transparent py-2 pl-3 text-sm outline-none"
            onChange={(e) => onRename(e.target.value)}
          />
        </label>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          title="สลับ / จัดการรายการ"
          className="flex items-center gap-1 self-stretch rounded-r-[var(--radius)] border-l border-line px-2.5 text-xs text-ink-3 transition hover:bg-accent-soft hover:text-accent"
          onClick={() => setOpen((v) => !v)}
        >
          {filings.length > 1 && <span>{filings.length}</span>}
          <ChevronDown className="size-4" />
          <span className="sr-only">สลับ / จัดการรายการ</span>
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-2 w-full min-w-[16rem] rounded-[var(--radius-lg)] border border-line bg-surface p-1.5 shadow-lg"
        >
          <p className="px-2.5 pt-1 pb-1.5 text-xs text-ink-3">รายการยื่นภาษีในเครื่องนี้</p>
          <div className="max-h-64 overflow-y-auto">
            {filings.map((f, i) => (
              <button
                key={f.id}
                type="button"
                role="menuitemradio"
                aria-checked={f.id === activeId}
                className={cn(MENU_ITEM, f.id === activeId && "font-medium text-accent")}
                onClick={run(() => onSelect(f.id))}
              >
                <Check className={cn("size-4 shrink-0", f.id !== activeId && "invisible")} />
                <span className="truncate">{filingLabel(f, i)}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <button type="button" role="menuitem" className={MENU_ITEM} onClick={run(onCreate)}>
              <FilePlus2 className="size-4" />
              สร้างรายการใหม่
            </button>
            <button
              type="button"
              role="menuitem"
              className={MENU_ITEM}
              onClick={run(() => onDuplicate(activeId))}
            >
              <Copy className="size-4" />
              ทำสำเนารายการนี้
            </button>
            <button
              type="button"
              role="menuitem"
              className={cn(MENU_ITEM, "hover:bg-danger-soft hover:text-danger")}
              onClick={run(() => {
                if (active && confirm(`ลบ "${filingLabel(active, index)}" ออกจากเครื่องนี้?`)) {
                  onDelete(activeId);
                }
              })}
            >
              <Trash2 className="size-4" />
              ลบรายการนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
