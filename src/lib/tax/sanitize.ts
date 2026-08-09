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
function resolveTaxYear(_value: unknown): TaxYear {
  return DEFAULT_TAX_YEAR;
}

function moneySource(source: IncomeSource): IncomeSource {
  return {
    ...source,
    amount: roundMoney(Math.max(0, source.amount)),
    withheld: roundMoney(Math.max(0, source.withheld)),
  };
}

function money404(source: Income404Source): Income404Source {
  return {
    ...source,
    amount: roundMoney(Math.max(0, source.amount)),
    withheld: roundMoney(Math.max(0, source.withheld)),
    taxCredit: roundMoney(Math.max(0, source.taxCredit)),
    importBreakdown: Array.isArray(source.importBreakdown)
      ? source.importBreakdown.map((row) => ({
          symbol: typeof row.symbol === "string" ? row.symbol : "",
          dividend: roundMoney(Math.max(0, row.dividend)),
          withheld: roundMoney(Math.max(0, row.withheld)),
          taxCredit: roundMoney(Math.max(0, row.taxCredit)),
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
    amount: roundMoney(Math.max(0, item.amount)),
  };
}

/** Normalize every money field to satang-safe baht values. */
export function sanitizeProfile(profile: TaxProfile): TaxProfile {
  return {
    ...profile,
    taxYear: resolveTaxYear(profile.taxYear),
    name: typeof profile.name === "string" ? profile.name : "",
    income401: profile.income401.map(moneySource),
    income402: profile.income402.map(moneySource),
    income404: profile.income404.map(money404),
    insurance: {
      lifeInsurance: roundMoney(Math.max(0, profile.insurance.lifeInsurance)),
      healthInsurance: roundMoney(Math.max(0, profile.insurance.healthInsurance)),
      parentHealthInsurance: roundMoney(
        Math.max(0, profile.insurance.parentHealthInsurance),
      ),
    },
    investment: {
      socialSecurity: roundMoney(Math.max(0, profile.investment.socialSecurity)),
      providentFund: roundMoney(Math.max(0, profile.investment.providentFund)),
      nationalSavingsFund: roundMoney(
        Math.max(0, profile.investment.nationalSavingsFund),
      ),
      rmf: roundMoney(Math.max(0, profile.investment.rmf)),
      thaiEsg: roundMoney(Math.max(0, profile.investment.thaiEsg)),
      homeLoanInterest: roundMoney(
        Math.max(0, profile.investment.homeLoanInterest),
      ),
    },
    specialDeductions: Array.isArray(profile.specialDeductions)
      ? profile.specialDeductions.map(moneySpecial)
      : [],
    donation: {
      general: roundMoney(Math.max(0, profile.donation.general)),
      education: roundMoney(Math.max(0, profile.donation.education)),
      political: roundMoney(Math.max(0, profile.donation.political)),
    },
  };
}
