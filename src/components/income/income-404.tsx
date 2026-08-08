"use client";

import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/section";
import { KIND_404_META } from "@/lib/tax/constants";
import type {
  Income404Decision,
  Income404Kind,
  Income404Source,
  TaxTreatment,
} from "@/lib/tax/types";
import { cn, formatThb, uid } from "@/lib/utils";

const KINDS = Object.keys(KIND_404_META) as Income404Kind[];

const TREATMENT_LABEL: Record<TaxTreatment, string> = {
  auto: "อัตโนมัติ (แนะนำ)",
  final: "ภาษีสุดท้าย",
  include: "รวมคำนวณ",
};

export function Income404Editor({
  sources,
  decisions,
  onChange,
}: {
  sources: Income404Source[];
  decisions: Income404Decision[];
  onChange: (next: Income404Source[]) => void;
}) {
  const decisionById = new Map(decisions.map((d) => [d.id, d]));

  function update(id: string, patch: Partial<Income404Source>) {
    const current = sources.find((s) => s.id === id);
    onChange(
      sources.map((s) => {
        if (s.id === id) return { ...s, ...patch };
        // ปันผลไทยที่ใช้เครดิตต้องเลือกวิธีเดียวกันทั้งปี (ป.119/2545)
        if (
          patch.treatment &&
          current?.kind === "thai_dividend" &&
          s.kind === "thai_dividend"
        ) {
          return { ...s, treatment: patch.treatment };
        }
        return s;
      }),
    );
  }

  function remove(id: string) {
    onChange(sources.filter((s) => s.id !== id));
  }

  function add(kind: Income404Kind = "interest") {
    onChange([
      ...sources,
      {
        id: uid(),
        label: KIND_404_META[kind].title,
        kind,
        amount: 0,
        withheld: 0,
        taxCredit: 0,
        treatment: "auto",
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <Button key={kind} type="button" onClick={() => add(kind)}>
            <Plus className="size-4" />
            {KIND_404_META[kind].title}
          </Button>
        ))}
      </div>

      {sources.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-line bg-surface-2 px-4 py-6 text-center text-sm text-ink-3">
          เพิ่มรายการดอกเบี้ย / เงินปันผล เพื่อให้ระบบแนะนำว่าควรเลือกภาษีสุดท้ายหรือรวมคำนวณ
        </p>
      ) : null}

      {sources.map((source) => {
        const meta = KIND_404_META[source.kind];
        const decision = decisionById.get(source.id);
        return (
          <div
            key={source.id}
            className="space-y-3 rounded-[var(--radius)] border border-line-2 bg-surface-2/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{meta.finalRateLabel}</Badge>
                  {decision ? (
                    <Badge tone={decision.recommended === "final" ? "warn" : "mint"}>
                      แนะนำ:{" "}
                      {decision.recommended === "final"
                        ? "ภาษีสุดท้าย"
                        : "รวมคำนวณ"}
                    </Badge>
                  ) : null}
                  {decision && decision.applied !== decision.recommended ? (
                    <Badge tone="muted">ใช้แบบที่เลือกเอง</Badge>
                  ) : null}
                </div>
                {decision && decision.savingsIfFollowRecommendation > 0 ? (
                  <p className="text-xs text-mint">
                    ทำตามคำแนะนำอาจประหยัดได้ประมาณ ฿
                    {formatThb(decision.savingsIfFollowRecommendation)}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => remove(source.id)}
              >
                <Trash2 className="size-4" />
                ลบ
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-1">
                <span className="text-sm font-medium text-ink-2">รายละเอียด</span>
                <input
                  className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  value={source.label}
                  onChange={(e) => update(source.id, { label: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-2">ประเภท</span>
                <select
                  className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  value={source.kind}
                  onChange={(e) =>
                    update(source.id, { kind: e.target.value as Income404Kind })
                  }
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_404_META[kind].title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-2">วิธีเสียภาษี</span>
                <select
                  className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  value={source.treatment}
                  onChange={(e) =>
                    update(source.id, {
                      treatment: e.target.value as TaxTreatment,
                    })
                  }
                >
                  {(Object.keys(TREATMENT_LABEL) as TaxTreatment[]).map((t) => (
                    <option key={t} value={t}>
                      {TREATMENT_LABEL[t]}
                    </option>
                  ))}
                </select>
                {source.kind === "thai_dividend" ? (
                  <span className="text-xs text-ink-3">
                    ปันผลไทยทั้งหมดต้องเลือกแบบเดียวกัน (ห้ามเลือกเฉพาะบางราย)
                  </span>
                ) : null}
              </label>

              <MoneyInput
                label="เงินได้รวม"
                value={source.amount}
                onChange={(amount) => update(source.id, { amount })}
              />
              <MoneyInput
                label="ภาษีหัก ณ ที่จ่าย"
                value={source.withheld}
                onChange={(withheld) => update(source.id, { withheld })}
              />

              {meta.hasTaxCredit ? (
                <MoneyInput
                  label="เครดิตภาษี (ม.47 ทวิ)"
                  value={source.taxCredit}
                  onChange={(taxCredit) => update(source.id, { taxCredit })}
                  hint="ถ้านำมารวมคำนวณ: บวกเป็นเงินได้ และนับเป็นภาษีที่จ่ายแล้ว"
                />
              ) : (
                <div className="hidden xl:block" />
              )}
            </div>

            {source.kind === "thai_dividend" ? (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-dashed border-accent/30 bg-accent-soft/50 px-3 py-2.5",
                )}
              >
                <div className="flex items-start gap-2 text-sm text-ink-2">
                  <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <p className="font-medium text-ink">นำเข้าจากไฟล์ .xlsx</p>
                    <p className="text-xs text-ink-3">
                      รองรับการนำเข้ารายการเงินปันผลไทยจากสเปรดชีต — เร็วๆ นี้
                    </p>
                  </div>
                </div>
                <Button type="button" disabled>
                  นำเข้า .xlsx
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
