"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import type { SpecialDeductionItem } from "@/lib/tax/types";
import { uid } from "@/lib/utils";

export function SpecialDeductionsEditor({
  items,
  onChange,
}: {
  items: SpecialDeductionItem[];
  onChange: (next: SpecialDeductionItem[]) => void;
}) {
  function update(id: string, patch: Partial<SpecialDeductionItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function add() {
    onChange([
      ...items,
      {
        id: uid(),
        label: "",
        amount: 0,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-3">
        ใส่ชื่อรายการและยอดที่หักได้ตามปีภาษีนั้น — หักก่อนเงินบริจาค
        และมีผลต่อฐานเพดานบริจาค 10%
      </p>

      {items.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line bg-surface-2 px-4 py-6 text-center text-sm text-ink-3">
          ยังไม่มีรายการ
        </p>
      ) : null}

      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-3 rounded-[var(--radius)] border border-line-2 bg-surface-2/60 p-3 md:grid-cols-[1.4fr_1fr_auto]"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              ชื่อรายการ {index + 1}
            </span>
            <input
              className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={item.label}
              placeholder="เช่น Easy E-Receipt, ค่าท่องเที่ยว"
              onChange={(e) => update(item.id, { label: e.target.value })}
            />
          </label>
          <MoneyInput
            label="จำนวนเงินที่หักได้"
            value={item.amount}
            onChange={(amount) => update(item.id, { amount })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="invisible text-sm font-medium select-none" aria-hidden>
              ลบ
            </span>
            <div className="flex min-h-[2.75rem] items-center">
              <Button
                type="button"
                variant="ghost"
                className="text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => remove(item.id)}
                aria-label="ลบ"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Button type="button" onClick={add}>
        <Plus className="size-4" />
        เพิ่มรายการ
      </Button>
    </div>
  );
}
