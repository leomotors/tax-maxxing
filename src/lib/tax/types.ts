/** ปีภาษีที่รองรับ (พ.ศ.) */
export type TaxYear = 2568;

export type IncomeSection =
  | "40_1"
  | "40_2"
  | "40_3"
  | "40_4"
  | "40_5"
  | "40_6"
  | "40_7"
  | "40_8";

/** ชนิดเงินได้ 40(4) */
export type Income404Kind =
  | "interest" // ก) ดอกเบี้ย — Final 15% หรือรวมคำนวณ
  | "foreign_dividend_equiv" // ข) เทียบเท่าเงินปันผลต่างประเทศ — Final 10%
  | "mutual_fund" // ค) ส่วนแบ่งกำไรกองทุนรวม — Final 10%
  | "thai_dividend"; // ง) เงินปันผลไทย — Final 10% + เครดิตภาษี

export type TaxTreatment = "auto" | "final" | "include";

export interface IncomeSource {
  id: string;
  label: string;
  amount: number;
  withheld: number;
}

export interface Income404Source {
  id: string;
  label: string;
  kind: Income404Kind;
  amount: number;
  withheld: number;
  /** เครดิตภาษี (เฉพาะเงินปันผลไทย) */
  taxCredit: number;
  treatment: TaxTreatment;
}

export interface PersonalDeductions {
  /** มีคู่สมรสที่ไม่มีเงินได้ / รวมยื่น */
  spouse: boolean;
  /** จำนวนบุตรทั่วไป (เกิดก่อน 2561) — คนละ 30,000 */
  children: number;
  /** จำนวนบุตรเกิดตั้งแต่ปี 2561 — คนละ 60,000 */
  childrenBornFrom2561: number;
  /** บิดา/มารดาของผู้มีเงินได้ — คนละ 30,000 สูงสุด 2 */
  ownParents: number;
  /** บิดา/มารดาของคู่สมรส */
  spouseParents: number;
  /** คนพิการ/ทุพพลภาพที่อุปการะ — คนละ 60,000 */
  disabledDependents: number;
}

export interface InsuranceDeductions {
  lifeInsurance: number;
  healthInsurance: number;
  parentHealthInsurance: number;
}

export interface InvestmentDeductions {
  socialSecurity: number;
  providentFund: number;
  nationalSavingsFund: number; // กอช.
  rmf: number;
  thaiEsg: number;
  homeLoanInterest: number;
}

export interface DonationDeductions {
  /** บริจาคทั่วไป (1 เท่า) — กรอกยอดจริง */
  general: number;
  /** บริจาคเพื่อการศึกษา/กีฬา/สาธารณประโยชน์ (หักได้ 2 เท่า) — กรอกยอดจริง */
  education: number;
  /** พรรคการเมือง สูงสุด 10,000 */
  political: number;
}

/** ลดหย่อนมาตรการพิเศษรายปี / อื่น ๆ (ก่อนเงินบริจาค) */
export interface SpecialDeductionItem {
  id: string;
  label: string;
  amount: number;
}

export interface TaxProfile {
  version: 1;
  taxYear: TaxYear;
  /** ชื่อชุดข้อมูล — ใช้เป็นชื่อไฟล์ JSON และโหลดกลับได้ */
  name: string;
  updatedAt: string;
  income401: IncomeSource[];
  income402: IncomeSource[];
  income404: Income404Source[];
  personal: PersonalDeductions;
  insurance: InsuranceDeductions;
  investment: InvestmentDeductions;
  /** ช้อปดีมีคืน, Easy E-Receipt, ค่าท่องเที่ยว, ซ่อมบ้าน ฯลฯ */
  specialDeductions: SpecialDeductionItem[];
  donation: DonationDeductions;
}

export interface BracketLine {
  from: number;
  to: number | null;
  rate: number;
  taxable: number;
  tax: number;
}

export interface Income404Decision {
  id: string;
  label: string;
  kind: Income404Kind;
  amount: number;
  withheld: number;
  taxCredit: number;
  treatment: TaxTreatment;
  /** ผลที่ระบบแนะนำ */
  recommended: "final" | "include";
  /** สิ่งที่ใช้จริงหลัง resolve auto */
  applied: "final" | "include";
  finalTaxAmount: number;
  savingsIfFollowRecommendation: number;
}

export interface DeductionSuggestion {
  key: "rmf" | "thaiEsg" | "donation";
  title: string;
  room: number;
  /** จำนวนที่แนะนำให้เพิ่มเพื่อลดภาษีสูงสุดในขั้นปัจจุบัน */
  suggestedAdditional: number;
  taxSaved: number;
  note: string;
}

export interface TaxBreakdown {
  assessableIncome: number;
  expenseDeduction: number;
  incomeAfterExpense: number;
  personalAllowance: number;
  /** ประกัน + ลงทุน/กองทุน/ดอกเบี้ยบ้าน */
  otherDeductions: number;
  /** มาตรการพิเศษรายปี / อื่น ๆ (ก่อนบริจาค) */
  specialDeduction: number;
  /** บริจาคการศึกษา/กีฬา ฯลฯ หลังคูณ 2 และเพดาน 10% */
  donationEducation: number;
  /** บริจาคทั่วไป หลังเพดาน 10% */
  donationGeneral: number;
  /** พรรคการเมือง (ไม่นับในเพดาน 10%) */
  donationPolitical: number;
  /** รวมเงินบริจาคทุกประเภท */
  donationDeduction: number;
  /** ฐานคำนวณเพดานบริจาค 10% */
  donationCapBase: number;
  donationMaxPool: number;
  netIncome: number;
  brackets: BracketLine[];
  progressiveTax: number;
  dividendTaxCredit: number;
  taxAfterCredit: number;
  finalTax: number;
  totalTax: number;
  withheldTotal: number;
  taxPayable: number;
  decisions404: Income404Decision[];
  suggestions: DeductionSuggestion[];
  marginalRate: number;
}
