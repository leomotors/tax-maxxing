"use client";

import { useState } from "react";

import { cn, formatThb, parseNumberInput, roundMoney } from "@/lib/utils";

interface MoneyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  className?: string;
  disabled?: boolean;
  /** Fraction digits when not focused. Default 2 (satang). */
  digits?: number;
}

export function MoneyInput({
  label,
  value,
  onChange,
  hint,
  className,
  disabled,
  digits = 2,
}: MoneyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft ?? (value === 0 ? "" : formatThb(value, { digits }));

  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-3">
          ฿
        </span>
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          className="number-input w-full rounded-[var(--radius)] border border-line bg-surface py-2.5 pr-3 pl-8 text-right font-medium tracking-tight text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
          value={display}
          placeholder="0.00"
          onFocus={() =>
            setDraft(value === 0 ? "" : String(roundMoney(value)))
          }
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            onChange(parseNumberInput(raw));
          }}
        />
      </div>
      {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}
