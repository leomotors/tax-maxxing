"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import { ChevronUp } from "lucide-react";

import type { TaxBreakdown } from "@/lib/tax/types";
import { cn, formatThb } from "@/lib/utils";

type Variant = "full" | "rail" | "float";

type MetricData = {
  key: string;
  label: string;
  value: number;
  secondary?: { label: string; value: number };
  hint?: string;
  emphasize?: boolean;
  positive?: boolean;
};

function sameMoney(a: number, b: number) {
  return Math.abs(a - b) < 0.005;
}

function buildMetrics(breakdown: TaxBreakdown): MetricData[] {
  const payable = breakdown.taxPayable;
  const isRefund = payable < 0;
  const progressive = breakdown.progressiveTax;
  const actualTax = breakdown.totalTax;
  const showActualSecondary = !sameMoney(progressive, actualTax);

  return [
    {
      key: "progressive",
      label: "ภาษีคำนวณจากเงินได้สุทธิ",
      value: progressive,
      // ภาษีที่เสียจริง = บันได + ภาษีสุดท้าย/เครดิต (ยอดที่หักกับข้อ 13 แล้วได้ยอดชำระ)
      secondary: showActualSecondary
        ? {
            label: "ภาษีที่เสียจริง",
            value: actualTax,
          }
        : undefined,
    },
    {
      key: "withheld",
      label: "หัก ณ ที่จ่ายแล้ว",
      value: breakdown.withheldTotal,
      hint:
        breakdown.dividendTaxCredit > 0
          ? `รวมทุกแหล่ง · ในนั้นเครดิตภาษี ฿${formatThb(breakdown.dividendTaxCredit)}`
          : "รวมทุกแหล่ง",
    },
    {
      key: "payable",
      label: isRefund ? "ชำระเกิน (ขอคืน)" : "ต้องชำระเพิ่ม",
      value: Math.abs(payable),
      hint: isRefund ? "ยอดประมาณการขอคืน" : "ยอดประมาณการที่ต้องจ่าย",
      emphasize: true,
      positive: isRefund,
    },
  ];
}

export function ResultHero({
  breakdown,
  variant = "full",
  className,
  anchorRef,
}: {
  breakdown: TaxBreakdown;
  variant?: Variant;
  className?: string;
  /** สำหรับ float: ซ่อนเมื่อการ์ดเต็มยังอยู่ในจอ */
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const metrics = buildMetrics(breakdown);

  if (variant === "rail") {
    return (
      <aside
        className={cn("hidden w-72 shrink-0 self-stretch xl:block", className)}
        aria-label="สรุปภาษี"
      >
        <div className="sticky top-24 space-y-2">
          <p className="px-1 text-xs font-medium tracking-wide text-ink-3 uppercase">
            สรุปภาษี
          </p>
          {metrics.map(({ key, ...m }) => (
            <Metric key={key} compact {...m} />
          ))}
        </div>
      </aside>
    );
  }

  if (variant === "float") {
    return (
      <FloatingSummary
        metrics={metrics}
        anchorRef={anchorRef}
        className={className}
      />
    );
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {metrics.map(({ key, ...m }) => (
        <Metric key={key} {...m} />
      ))}
    </div>
  );
}

function FloatingSummary({
  metrics,
  anchorRef,
  className,
}: {
  metrics: MetricData[];
  anchorRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const anchor = anchorRef?.current;
    if (!anchor) {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    io.observe(anchor);
    return () => io.disconnect();
  }, [anchorRef]);

  useEffect(() => {
    if (!show) setOpen(false);
  }, [show]);

  const payable = metrics.find((m) => m.key === "payable");
  if (!payable) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden",
        "transition duration-200",
        show
          ? "pointer-events-none translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
        className,
      )}
      aria-hidden={!show}
    >
      <div
        className={cn(
          "w-full max-w-[20rem] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface/95 shadow-lg shadow-teal-950/10 backdrop-blur-md",
          show && "pointer-events-auto",
        )}
      >
        <button
          type="button"
          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
          aria-expanded={open}
          aria-controls={panelId}
          tabIndex={show ? 0 : -1}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">
              {payable.label}
            </p>
            <p
              className={cn(
                "text-lg font-semibold tracking-tight tabular-nums",
                payable.positive ? "text-mint" : "text-accent",
              )}
            >
              ฿{formatThb(payable.value)}
            </p>
          </div>
          <ChevronUp
            className={cn(
              "size-4 shrink-0 text-ink-3 transition",
              open ? "rotate-0" : "rotate-180",
            )}
          />
        </button>
        <div
          id={panelId}
          className={cn(
            "grid transition-[grid-template-rows] duration-200",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-1.5 border-t border-line-2 px-3 pb-3 pt-2">
              {metrics.map(({ key, ...m }) => (
                <Metric key={key} float {...m} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  secondary,
  emphasize,
  positive,
  compact,
  float,
}: {
  label: string;
  value: number;
  hint?: string;
  secondary?: { label: string; value: number };
  emphasize?: boolean;
  positive?: boolean;
  compact?: boolean;
  float?: boolean;
}) {
  const shell = compact
    ? "rounded-[var(--radius)] border px-3 py-2.5"
    : float
      ? "rounded-[var(--radius)] border px-2.5 py-2"
      : "rounded-[var(--radius)] border px-4 py-3";

  const tone = emphasize
    ? positive
      ? "border-mint/30 bg-mint-soft/50"
      : "border-accent/25 bg-accent-soft/60"
    : "border-line bg-surface";

  return (
    <div className={cn(shell, tone)}>
      <p
        className={cn(
          "font-medium tracking-wide text-ink-3 uppercase",
          float ? "text-[10px]" : "text-xs",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-semibold tracking-tight tabular-nums",
          float ? "text-base" : compact ? "text-xl" : "text-2xl",
          emphasize ? (positive ? "text-mint" : "text-accent") : "text-ink",
        )}
      >
        ฿{formatThb(value)}
      </p>
      {secondary && !float ? (
        <p
          className={cn(
            "mt-1 tabular-nums text-ink-2",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {secondary.label}{" "}
          <span className="font-medium text-ink">
            ฿{formatThb(secondary.value)}
          </span>
        </p>
      ) : null}
      {secondary && float ? (
        <p className="mt-0.5 text-[11px] tabular-nums text-ink-3">
          {secondary.label} ฿{formatThb(secondary.value)}
        </p>
      ) : null}
      {hint && !float ? (
        <p className={cn("mt-0.5 text-ink-3", compact ? "text-[11px]" : "text-xs")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
