"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import type { IncomeSource } from "@/lib/tax/types";
import { uid } from "@/lib/utils";

type Section12 = "40_1" | "40_2";

interface Row extends IncomeSource {
  section: Section12;
}

const SECTION_LABEL: Record<Section12, string> = {
  "40_1": "40(1) เงินเดือน / ค่าจ้าง",
  "40_2": "40(2) ค่านายหน้า / จ้างทำของ",
};

export function Income401402Editor({
  income401,
  income402,
  onChange,
}: {
  income401: IncomeSource[];
  income402: IncomeSource[];
  onChange: (next: { income401: IncomeSource[]; income402: IncomeSource[] }) => void;
}) {
  const rows: Row[] = [
    ...income401.map((s) => ({ ...s, section: "40_1" as const })),
    ...income402.map((s) => ({ ...s, section: "40_2" as const })),
  ];

  function commit(nextRows: Row[]) {
    onChange({
      income401: nextRows
        .filter((r) => r.section === "40_1")
        .map(({ id, label, amount, withheld }) => ({ id, label, amount, withheld })),
      income402: nextRows
        .filter((r) => r.section === "40_2")
        .map(({ id, label, amount, withheld }) => ({ id, label, amount, withheld })),
    });
  }

  function update(id: string, patch: Partial<Row>) {
    commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function remove(id: string) {
    commit(rows.filter((r) => r.id !== id));
  }

  function add(section: Section12 = "40_1") {
    commit([
      ...rows,
      {
        id: uid(),
        section,
        label: `แหล่งที่ ${rows.length + 1}`,
        amount: 0,
        withheld: 0,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => add("40_1")}>
          <Plus className="size-4" />
          เพิ่ม 40(1)
        </Button>
        <Button type="button" onClick={() => add("40_2")}>
          <Plus className="size-4" />
          เพิ่ม 40(2)
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line bg-surface-2 px-4 py-6 text-center text-sm text-ink-3">
          ยังไม่มีรายการ — เพิ่มแหล่งเงินได้ 40(1) หรือ 40(2) ได้หลายบริษัท/แหล่ง
        </p>
      ) : null}

      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-3 rounded-[var(--radius)] border border-line-2 bg-surface-2/60 p-3 md:grid-cols-[1fr_1.2fr_1fr_1fr_auto]"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">มาตรา</span>
            <select
              className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={row.section}
              onChange={(e) =>
                update(row.id, { section: e.target.value as Section12 })
              }
            >
              {(Object.keys(SECTION_LABEL) as Section12[]).map((s) => (
                <option key={s} value={s}>
                  {SECTION_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">แหล่งที่มา</span>
            <input
              className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={row.label}
              onChange={(e) => update(row.id, { label: e.target.value })}
            />
          </label>
          <MoneyInput
            label="เงินได้"
            value={row.amount}
            onChange={(amount) => update(row.id, { amount })}
          />
          <MoneyInput
            label="ภาษีหัก ณ ที่จ่าย"
            value={row.withheld}
            onChange={(withheld) => update(row.id, { withheld })}
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
                onClick={() => remove(row.id)}
                aria-label="ลบ"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
