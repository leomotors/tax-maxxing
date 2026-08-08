import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { roundMoney } from "@/lib/money";

export { roundMoney } from "@/lib/money";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatThb(value: number, opts?: { digits?: number }) {
  const digits = opts?.digits ?? 2;
  const rounded =
    digits === 2 ? roundMoney(value) : roundToDigits(value, digits);
  return new Intl.NumberFormat("th-TH", {
    style: "decimal",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded);
}

function roundToDigits(value: number, digits: number) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return (
    Math.round(value * factor + Math.sign(value || 1) * 1e-6) / factor
  );
}

export function parseNumberInput(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

export function uid() {
  return crypto.randomUUID();
}
