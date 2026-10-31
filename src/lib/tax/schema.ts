import { z } from "zod";

import { emptyProfile } from "@/lib/tax/calculate";
import { DEFAULT_TAX_YEAR } from "@/lib/tax/constants";
import { sanitizeProfile } from "@/lib/tax/sanitize";
import type { TaxProfile } from "@/lib/tax/types";
import { uid } from "@/lib/utils";

// Lenient on purpose: the old app saved fractional/huge values (and Infinity → null).
// sanitizeProfile clamps them, so saved data and legacy data both load.
const num = z.preprocess((v) => (v === null ? 0 : v), z.number());
const money = num;
const count = num;

const incomeSource = z.object({
  id: z.string(),
  label: z.string(),
  amount: money,
  withheld: money,
});

const income404Source = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["interest", "foreign_dividend_equiv", "mutual_fund", "thai_dividend"]),
  amount: money,
  withheld: money,
  taxCredit: money,
  treatment: z.enum(["auto", "final", "include"]),
  importBreakdown: z
    .array(
      z.object({
        symbol: z.string(),
        dividend: money,
        withheld: money,
        taxCredit: money,
        citRates: z.array(z.string()),
      }),
    )
    .optional(),
});

const taxProfileSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  // Single supported year: older years are relabelled by sanitizeProfile.
  taxYear: z.number().int(),
  name: z.string(),
  updatedAt: z.string(),
  income401: z.array(incomeSource),
  income402: z.array(incomeSource),
  income404: z.array(income404Source),
  personal: z.object({
    spouse: z.boolean(),
    children: count,
    childrenBornFrom2561: count,
    ownParents: count,
    spouseParents: count,
    disabledDependents: count,
  }),
  insurance: z.object({
    lifeInsurance: money,
    healthInsurance: money,
    parentHealthInsurance: money,
  }),
  investment: z.object({
    socialSecurity: money,
    providentFund: money,
    nationalSavingsFund: money,
    rmf: money,
    thaiEsg: money,
    homeLoanInterest: money,
  }),
  specialDeductions: z.array(
    z.object({ id: z.string(), label: z.string(), amount: money }),
  ),
  donation: z.object({
    general: money,
    education: money,
    political: money,
  }),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fill fields that older saves may omit, before strict validation. */
function withLegacyDefaults(raw: Record<string, unknown>) {
  const base = emptyProfile(DEFAULT_TAX_YEAR);
  // Only omitted sections get defaults; an explicit null/garbage must fail validation.
  const nested = (key: "personal" | "insurance" | "investment" | "donation") =>
    raw[key] === undefined
      ? base[key]
      : isRecord(raw[key])
        ? { ...base[key], ...raw[key] }
        : raw[key];
  return {
    ...base,
    ...raw,
    id: typeof raw.id === "string" && raw.id ? raw.id : base.id,
    personal: nested("personal"),
    insurance: nested("insurance"),
    investment: nested("investment"),
    donation: nested("donation"),
  };
}

export class ProfileValidationError extends Error {}

/** Validate an untrusted profile (file, Drive, localStorage) and normalize it. */
export function parseProfile(raw: unknown): TaxProfile {
  if (!isRecord(raw) || raw.version !== 1) {
    throw new ProfileValidationError("รูปแบบข้อมูลไม่รองรับ (ต้องการ version: 1)");
  }
  const result = taxProfileSchema.safeParse(withLegacyDefaults(raw));
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ProfileValidationError(
      `ข้อมูลไม่ถูกต้องที่ ${issue?.path.join(".") || "(root)"}`,
    );
  }
  const data = result.data;
  return sanitizeProfile({
    ...data,
    income401: uniqueIds(data.income401),
    income402: uniqueIds(data.income402),
    // The engine keys 40(4) treatments by id: duplicates would share one treatment.
    income404: uniqueIds(data.income404),
    specialDeductions: uniqueIds(data.specialDeductions),
    taxYear: DEFAULT_TAX_YEAR,
  } as TaxProfile);
}

function uniqueIds<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const id = row.id && !seen.has(row.id) ? row.id : uid();
    seen.add(id);
    return id === row.id ? row : { ...row, id };
  });
}
