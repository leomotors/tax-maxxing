"use client";

import { formatThb } from "@/lib/utils";

export function ExpenseSummary({
  ruleLabel,
  income,
  expense,
  remaining,
  note,
  /** ยังไม่คำนวณจริง (มาตราที่ยังไม่เปิดใช้) */
  pending,
  /** มาตรานี้หักค่าใช้จ่ายไม่ได้ */
  none,
}: {
  ruleLabel: string;
  income?: number;
  expense?: number;
  remaining?: number;
  note?: string;
  pending?: boolean;
  none?: boolean;
}) {
  return (
    <div className="mt-3 rounded-[var(--radius)] border border-line bg-surface-2/80 px-3 py-3">
      <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">
        ค่าใช้จ่าย
      </p>
      <p className="mt-0.5 text-sm text-ink-2">{ruleLabel}</p>

      {none ? null : pending ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Stat label="เงินได้" value={null} />
          <Stat label="หักค่าใช้จ่าย" value={null} />
          <Stat label="คงเหลือ" value={null} />
        </div>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Stat label="เงินได้" value={income ?? 0} />
          <Stat label="หักค่าใช้จ่าย" value={expense ?? 0} tone="muted" />
          <Stat label="คงเหลือ" value={remaining ?? 0} tone="accent" />
        </div>
      )}

      {pending && !none ? (
        <p className="mt-2 text-xs text-ink-3">
          ยังไม่เปิดให้กรอก — จะแสดงยอดหักและคงเหลือเมื่อรองรับมาตรานี้
        </p>
      ) : null}

      {note ? <p className="mt-2 text-xs text-ink-3">{note}</p> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | null;
  tone?: "default" | "muted" | "accent";
}) {
  const valueClass =
    tone === "accent"
      ? "text-accent"
      : tone === "muted"
        ? "text-ink-2"
        : "text-ink";

  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${valueClass}`}>
        {value == null ? "—" : `฿${formatThb(value)}`}
      </p>
    </div>
  );
}
