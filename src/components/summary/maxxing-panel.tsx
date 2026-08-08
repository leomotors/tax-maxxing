"use client";

import { Lightbulb, Sparkles, Target } from "lucide-react";

import { Badge } from "@/components/ui/section";
import { KIND_404_META } from "@/lib/tax/constants";
import type { TaxBreakdown } from "@/lib/tax/types";
import { formatThb } from "@/lib/utils";

export function MaxxingPanel({ breakdown }: { breakdown: TaxBreakdown }) {
  const { decisions404, suggestions, marginalRate } = breakdown;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="mint">อัตรากำไรส่วนเพิ่ม {(marginalRate * 100).toFixed(0)}%</Badge>
        <span className="text-sm text-ink-2">
          เปรียบเทียบจากภาษีที่ต้องชำระเพิ่ม / ได้คืน (ไม่ใช่ภาษีรวมก่อนหัก)
        </span>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent" />
          คำแนะนำ 40(4) — ภาษีสุดท้าย vs รวมบันได
        </h3>
        {decisions404.length === 0 ? (
          <p className="text-sm text-ink-3">เพิ่มรายการ 40(4) เพื่อรับคำแนะนำ</p>
        ) : (
          <ul className="space-y-2">
            {decisions404.map((d) => (
              <li
                key={d.id}
                className="rounded-[var(--radius)] border border-line-2 bg-surface-2/70 px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{d.label}</span>
                  <Badge tone={d.recommended === "include" ? "mint" : "warn"}>
                    แนะนำ:{" "}
                    {d.recommended === "include" ? "รวมคำนวณ" : "ภาษีสุดท้าย"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {KIND_404_META[d.kind].title} · ภาษีสุดท้ายประมาณ ฿
                  {formatThb(d.finalTaxAmount)} · ใช้จริง:{" "}
                  {d.applied === "include" ? "รวมคำนวณ" : "ภาษีสุดท้าย"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <Target className="size-4 text-accent" />
          ถ้าลงทุน / บริจาคเพิ่ม จะลดภาษีได้เท่าไร
        </h3>
        {suggestions.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-ink-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0" />
            ไม่มีวงเงินเหลือ หรืออัตรากำไรส่วนเพิ่มเป็น 0% — ลดหย่อนเพิ่มจะไม่ช่วยลดภาษีปีนี้
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.key}
                className="rounded-[var(--radius)] border border-mint/20 bg-mint-soft/40 px-3 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="text-sm font-semibold text-mint">
                    ลดภาษีได้ ~฿{formatThb(s.taxSaved)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ink-2">
                  ลงทุน/บริจาคเพิ่ม ฿{formatThb(s.suggestedAdditional)}
                </p>
                <p className="mt-1 text-xs text-ink-3">{s.note}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
