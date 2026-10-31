import { roundMoney } from "@/lib/money";
import { DEFAULT_TAX_YEAR } from "@/lib/tax/constants";

import type {
  Income404Source,
  IncomeSource,
  SpecialDeductionItem,
  TaxProfile,
  TaxYear,
} from "@/lib/tax/types";

/** แอปนี้รองรับปีภาษีเดียว — โปรไฟล์เก่าจะถูกย้ายมาปีปัจจุบัน */
function resolveTaxYear(): TaxYear {
  return DEFAULT_TAX_YEAR;
}

function moneySource(source: IncomeSource): IncomeSource {
  return {
    ...source,
    amount: safeMoney(source.amount),
    withheld: safeMoney(source.withheld),
  };
}

function money404(source: Income404Source): Income404Source {
  return {
    ...source,
    amount: safeMoney(source.amount),
    withheld: safeMoney(source.withheld),
    taxCredit: safeMoney(source.taxCredit),
    importBreakdown: Array.isArray(source.importBreakdown)
      ? source.importBreakdown.map((row) => ({
          symbol: typeof row.symbol === "string" ? row.symbol : "",
          dividend: safeMoney(row.dividend),
          withheld: safeMoney(row.withheld),
          taxCredit: safeMoney(row.taxCredit),
          citRates: Array.isArray(row.citRates)
            ? row.citRates.map(String)
            : [],
        }))
      : undefined,
  };
}

function moneySpecial(item: SpecialDeductionItem): SpecialDeductionItem {
  return {
    ...item,
    label: typeof item.label === "string" ? item.label : "",
    amount: safeMoney(item.amount),
  };
}

/** Upper bound so satang conversion can't overflow to Infinity (saved as null). */
const MAX_MONEY = 1e12;

function safeMoney(value: number) {
  return Number.isFinite(value) ? roundMoney(Math.min(Math.max(0, value), MAX_MONEY)) : 0;
}

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(0, Math.floor(value)), 1000) : 0;
}

/** Normalize every money field to satang-safe baht values. */
export function sanitizeProfile(profile: TaxProfile): TaxProfile {
  return {
    ...profile,
    taxYear: resolveTaxYear(),
    name: typeof profile.name === "string" ? profile.name : "",
    personal: {
      spouse: Boolean(profile.personal.spouse),
      children: safeCount(profile.personal.children),
      childrenBornFrom2561: safeCount(profile.personal.childrenBornFrom2561),
      ownParents: safeCount(profile.personal.ownParents),
      spouseParents: safeCount(profile.personal.spouseParents),
      disabledDependents: safeCount(profile.personal.disabledDependents),
    },
    income401: profile.income401.map(moneySource),
    income402: profile.income402.map(moneySource),
    income404: profile.income404.map(money404),
    insurance: {
      lifeInsurance: safeMoney(profile.insurance.lifeInsurance),
      healthInsurance: safeMoney(profile.insurance.healthInsurance),
      parentHealthInsurance: safeMoney(profile.insurance.parentHealthInsurance),
    },
    investment: {
      socialSecurity: safeMoney(profile.investment.socialSecurity),
      providentFund: safeMoney(profile.investment.providentFund),
      nationalSavingsFund: safeMoney(profile.investment.nationalSavingsFund),
      rmf: safeMoney(profile.investment.rmf),
      thaiEsg: safeMoney(profile.investment.thaiEsg),
      homeLoanInterest: safeMoney(profile.investment.homeLoanInterest),
    },
    specialDeductions: Array.isArray(profile.specialDeductions)
      ? profile.specialDeductions.map(moneySpecial)
      : [],
    donation: {
      general: safeMoney(profile.donation.general),
      education: safeMoney(profile.donation.education),
      political: safeMoney(profile.donation.political),
    },
  };
}
