import type { Income404Kind, IncomeSection } from "./types";

/** อัตราภาษีแบบขั้นบันได (ปีภาษี 2569) */
export const TAX_BRACKETS = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
] as const;

/** ปีภาษีที่แอปนี้วางแผน (พ.ศ.) */
export const DEFAULT_TAX_YEAR = 2569 as const;

export const PERSONAL_ALLOWANCE = 60_000;
export const SPOUSE_ALLOWANCE = 60_000;
export const CHILD_ALLOWANCE = 30_000;
export const CHILD_BORN_FROM_2561_ALLOWANCE = 60_000;
export const PARENT_ALLOWANCE = 30_000;
export const DISABLED_DEPENDENT_ALLOWANCE = 60_000;

/** ค่าใช้จ่ายเหมา 40(1)+40(2) รวมกันไม่เกิน */
export const EXPENSE_401_402_RATE = 0.5;
export const EXPENSE_401_402_CAP = 100_000;

export const LIFE_INSURANCE_CAP = 100_000;
export const HEALTH_INSURANCE_CAP = 25_000;
export const LIFE_PLUS_HEALTH_CAP = 100_000;
export const PARENT_HEALTH_INSURANCE_CAP = 15_000;

/**
 * ประกันสังคม ม.33 ปี 2569: ฐานค่าจ้างสูงสุด 17,500 × 5% = 875/เดือน
 * → สูงสุดทั้งปี 10,500
 */
export const SOCIAL_SECURITY_MONTHLY_CAP = 875;
export const SOCIAL_SECURITY_CAP = SOCIAL_SECURITY_MONTHLY_CAP * 12;
export const HOME_LOAN_INTEREST_CAP = 100_000;

/** ลงทุนเพื่อการเกษียณรวม (PVD + กบข. + RMF + กอช. ฯลฯ) */
export const RETIREMENT_COMBINED_CAP = 500_000;
/** กองทุนสำรองเลี้ยงชีพ / กบข. — ไม่เกิน 15% ของเงินได้ */
export const PROVIDENT_FUND_INCOME_RATE = 0.15;
/** กอช. — สูงสุดต่อปี */
export const NATIONAL_SAVINGS_FUND_CAP = 30_000;
export const RMF_INCOME_RATE = 0.3;
export const THAI_ESG_INCOME_RATE = 0.3;
export const THAI_ESG_CAP = 300_000;

export const DONATION_NET_INCOME_RATE = 0.1;
export const POLITICAL_DONATION_CAP = 10_000;

export const FINAL_TAX_RATE: Record<Income404Kind, number> = {
  interest: 0.15,
  foreign_dividend_equiv: 0.1,
  mutual_fund: 0.1,
  thai_dividend: 0.1,
};

export type ExpenseRuleKind = "shared_401_402" | "none" | "standard_rate";

export interface IncomeSectionMeta {
  title: string;
  short: string;
  available: boolean;
  description: string;
  /** หักค่าใช้จ่ายได้หรือไม่ */
  hasExpense: boolean;
  expenseRule: ExpenseRuleKind;
  /** คำอธิบายอัตราค่าใช้จ่ายเหมา */
  expenseLabel: string;
}

export const INCOME_SECTION_META: Record<IncomeSection, IncomeSectionMeta> = {
  "40_1": {
    title: "มาตรา 40(1) เงินได้จากงานจ้าง",
    short: "40(1) เงินเดือน",
    available: true,
    description: "เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส จากนายจ้าง",
    hasExpense: true,
    expenseRule: "shared_401_402",
    expenseLabel: "50% ของเงินได้ 40(1)+40(2) รวมกัน สูงสุด 100,000",
  },
  "40_2": {
    title: "มาตรา 40(2) เงินได้จากงานจ้างทำของ / ค่านายหน้า",
    short: "40(2) ค่านายหน้า",
    available: true,
    description: "ค่าธรรมเนียม ค่านายหน้า จากการรับจ้างทำงานให้ผู้อื่น",
    hasExpense: true,
    expenseRule: "shared_401_402",
    expenseLabel: "50% ของเงินได้ 40(1)+40(2) รวมกัน สูงสุด 100,000",
  },
  "40_3": {
    title: "มาตรา 40(3) ค่าแห่งลิขสิทธิ์ / ค่าความนิยม",
    short: "40(3)",
    available: false,
    description: "เร็วๆ นี้",
    hasExpense: true,
    expenseRule: "standard_rate",
    expenseLabel: "โดยทั่วไป 50% สูงสุด 100,000 (ขึ้นกับประเภทรายได้)",
  },
  "40_4": {
    title: "มาตรา 40(4) ดอกเบี้ย เงินปันผล และในทำนองเดียวกัน",
    short: "40(4) ดอกเบี้ย/ปันผล",
    available: true,
    description:
      "เลือกเสียภาษีสุดท้าย หรือนำมารวมคำนวณ — จุดเด่นของ Tax-Maxxing",
    hasExpense: false,
    expenseRule: "none",
    expenseLabel: "หักค่าใช้จ่ายไม่ได้",
  },
  "40_5": {
    title: "มาตรา 40(5) ค่าเช่าทรัพย์สิน",
    short: "40(5)",
    available: false,
    description: "เร็วๆ นี้",
    hasExpense: true,
    expenseRule: "standard_rate",
    expenseLabel: "เหมา 10%–30% ตามประเภททรัพย์สินที่ให้เช่า",
  },
  "40_6": {
    title: "มาตรา 40(6) วิชาชีพอิสระ",
    short: "40(6)",
    available: false,
    description: "เร็วๆ นี้",
    hasExpense: true,
    expenseRule: "standard_rate",
    expenseLabel: "เหมา 30%–60% ตามวิชาชีพ",
  },
  "40_7": {
    title: "มาตรา 40(7) การรับเหมา",
    short: "40(7)",
    available: false,
    description: "เร็วๆ นี้",
    hasExpense: true,
    expenseRule: "standard_rate",
    expenseLabel: "เหมา 60% ของเงินได้",
  },
  "40_8": {
    title: "มาตรา 40(8) ธุรกิจ การพาณิชย์ เกษตรกรรม ฯลฯ",
    short: "40(8)",
    available: false,
    description: "เร็วๆ นี้",
    hasExpense: true,
    expenseRule: "standard_rate",
    expenseLabel: "เหมาตามประเภทกิจการ (โดยทั่วไป 60%–85%)",
  },
};

export const KIND_404_META: Record<
  Income404Kind,
  { title: string; finalRateLabel: string; hasTaxCredit: boolean; choosable: boolean }
> = {
  interest: {
    title: "ก) ดอกเบี้ย / ส่วนต่างตั๋วเงิน",
    finalRateLabel: "ภาษีสุดท้าย 15%",
    hasTaxCredit: false,
    choosable: true,
  },
  foreign_dividend_equiv: {
    title: "ข) เงินเทียบเท่าเงินปันผลจากต่างประเทศ",
    finalRateLabel: "ภาษีสุดท้าย 10%",
    hasTaxCredit: false,
    choosable: true,
  },
  mutual_fund: {
    title: "ค) ส่วนแบ่งกำไรจากกองทุนรวม",
    finalRateLabel: "ภาษีสุดท้าย 10%",
    hasTaxCredit: false,
    choosable: true,
  },
  thai_dividend: {
    title: "ง) เงินปันผลจากบริษัทไทย",
    finalRateLabel: "ภาษีสุดท้าย 10% หรือรวมคำนวณ + เครดิตภาษี*",
    hasTaxCredit: true,
    choosable: true,
  },
};
