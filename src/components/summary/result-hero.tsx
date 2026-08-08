"use client";

import type { TaxBreakdown } from "@/lib/tax/types";
import { formatThb } from "@/lib/utils";

export function ResultHero({ breakdown }: { breakdown: TaxBreakdown }) {
  const payable = breakdown.taxPayable;
  const isRefund = payable < 0;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric
        label="ภาษีทั้งสิ้น"
        value={breakdown.totalTax}
        hint="บันได + ภาษีสุดท้าย"
      />
      <Metric
        label="หัก ณ ที่จ่ายแล้ว"
        value={breakdown.withheldTotal}
        hint={
          breakdown.dividendTaxCredit > 0
            ? `รวมทุกแหล่ง · ในนั้นเครดิตภาษี ฿${formatThb(breakdown.dividendTaxCredit)}`
            : "รวมทุกแหล่ง"
        }
      />
      <Metric
        label={isRefund ? "ชำระเกิน (ขอคืน)" : "ต้องชำระเพิ่ม"}
        value={Math.abs(payable)}
        hint={isRefund ? "ยอดประมาณการขอคืน" : "ยอดประมาณการที่ต้องจ่าย"}
        emphasize
        positive={isRefund}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  emphasize,
  positive,
}: {
  label: string;
  value: number;
  hint: string;
  emphasize?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] border px-4 py-3 ${
        emphasize
          ? positive
            ? "border-mint/30 bg-mint-soft/50"
            : "border-accent/25 bg-accent-soft/60"
          : "border-line bg-surface"
      }`}
    >
      <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${
          emphasize ? (positive ? "text-mint" : "text-accent") : "text-ink"
        }`}
      >
        ฿{formatThb(value)}
      </p>
      <p className="mt-0.5 text-xs text-ink-3">{hint}</p>
    </div>
  );
}
