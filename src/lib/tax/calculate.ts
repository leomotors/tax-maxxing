import {
  addMoney,
  fromSatang,
  mulRate,
  mulRateFloor,
  roundMoney,
  subMoney,
  sumMoneyField,
  toSatang,
} from "@/lib/money";

import {
  CHILD_ALLOWANCE,
  CHILD_BORN_FROM_2561_ALLOWANCE,
  DEFAULT_TAX_YEAR,
  DISABLED_DEPENDENT_ALLOWANCE,
  DONATION_NET_INCOME_RATE,
  EXPENSE_401_402_CAP,
  EXPENSE_401_402_RATE,
  FINAL_TAX_RATE,
  HEALTH_INSURANCE_CAP,
  HOME_LOAN_INTEREST_CAP,
  KIND_404_META,
  LIFE_INSURANCE_CAP,
  LIFE_PLUS_HEALTH_CAP,
  NATIONAL_SAVINGS_FUND_CAP,
  PARENT_ALLOWANCE,
  PARENT_HEALTH_INSURANCE_CAP,
  PERSONAL_ALLOWANCE,
  POLITICAL_DONATION_CAP,
  PROVIDENT_FUND_INCOME_RATE,
  RETIREMENT_COMBINED_CAP,
  RMF_INCOME_RATE,
  SOCIAL_SECURITY_CAP,
  SPOUSE_ALLOWANCE,
  TAX_BRACKETS,
  THAI_ESG_CAP,
  THAI_ESG_INCOME_RATE,
} from "./constants";
import type {
  BracketLine,
  DeductionSuggestion,
  Income404Decision,
  Income404Source,
  TaxBreakdown,
  TaxProfile,
  TaxYear,
} from "./types";

type Applied404 = Income404Source & { applied: "final" | "include" };

function sumAmount(items: { amount: number }[]) {
  return sumMoneyField(items, "amount");
}

function sumWithheld(items: { withheld: number }[]) {
  return sumMoneyField(items, "withheld");
}

/** เงินได้ 40(4) ที่นำมารวม — ปันผลไทย gross-up ด้วยเครดิตภาษี (ม.47 ทวิ) */
function included404Assessable(items: Applied404[]) {
  let total = 0;
  for (const item of items) {
    if (item.applied !== "include") continue;
    total += toSatang(Math.max(0, item.amount));
    if (item.kind === "thai_dividend") {
      total += toSatang(Math.max(0, item.taxCredit));
    }
  }
  return fromSatang(total);
}

/**
 * ภาษีที่ชำระแล้วจาก 40(4) ที่ขึ้น ภ.ง.ด. เท่านั้น (applied = include):
 * - หัก ณ ที่จ่ายของรายการที่นำมารวม
 * - ปันผลไทย: + เครดิตภาษี (ม.47 ทวิ)
 * รายการ final อยู่นอกแบบ — ไม่นับที่นี่ (ไปข้อ 11 แทน)
 */
function withheld404OnForm(items: Applied404[]) {
  let total = 0;
  for (const item of items) {
    if (item.applied !== "include") continue;
    total += toSatang(Math.max(0, item.withheld));
    if (item.kind === "thai_dividend") {
      total += toSatang(Math.max(0, item.taxCredit));
    }
  }
  return fromSatang(total);
}

export function progressiveTax(netIncome: number): {
  tax: number;
  brackets: BracketLine[];
  marginalRate: number;
} {
  let remainingSatang = Math.max(0, toSatang(netIncome));
  const brackets: BracketLine[] = [];
  let lower = 0;
  let taxSatang = 0;
  let marginalRate = 0;

  for (const b of TAX_BRACKETS) {
    const maxSpanSatang =
      b.upTo === Infinity ? remainingSatang : toSatang(b.upTo) - toSatang(lower);
    const taxableSatang = Math.min(remainingSatang, Math.max(0, maxSpanSatang));
    const sliceTaxSatang = Math.round(taxableSatang * b.rate);
    taxSatang += sliceTaxSatang;
    brackets.push({
      from: lower + (lower === 0 ? 0 : 1),
      to: b.upTo === Infinity ? null : b.upTo,
      rate: b.rate,
      taxable: fromSatang(taxableSatang),
      tax: fromSatang(sliceTaxSatang),
    });
    if (taxableSatang > 0) marginalRate = b.rate;
    remainingSatang -= taxableSatang;
    if (b.upTo !== Infinity) lower = b.upTo;
  }

  return { tax: fromSatang(taxSatang), brackets, marginalRate };
}

/**
 * ค่าใช้จ่ายเหมา 40(1)+40(2): 50% ปัดลงที่สตางค์ แล้วค่อยเพดาน 100,000
 * เช่น 1.23 → หัก 0.61 คงเหลือ 0.62
 */
export function expense401402(income401: number, income402: number) {
  const base = addMoney(Math.max(0, income401), Math.max(0, income402));
  const half = mulRateFloor(base, EXPENSE_401_402_RATE);
  return Math.min(half, EXPENSE_401_402_CAP);
}

function clampMoney(n: number, max: number) {
  return roundMoney(Math.min(Math.max(0, n), max));
}

function personalDeductions(profile: TaxProfile) {
  const p = profile.personal;
  let total = PERSONAL_ALLOWANCE;
  if (p.spouse) total += SPOUSE_ALLOWANCE;
  total += Math.max(0, p.children) * CHILD_ALLOWANCE;
  total += Math.max(0, p.childrenBornFrom2561) * CHILD_BORN_FROM_2561_ALLOWANCE;
  total += Math.min(Math.max(0, p.ownParents), 2) * PARENT_ALLOWANCE;
  total += Math.min(Math.max(0, p.spouseParents), 2) * PARENT_ALLOWANCE;
  total += Math.max(0, p.disabledDependents) * DISABLED_DEPENDENT_ALLOWANCE;
  return roundMoney(total);
}

function insuranceDeductions(profile: TaxProfile) {
  const life = clampMoney(profile.insurance.lifeInsurance, LIFE_INSURANCE_CAP);
  const health = clampMoney(profile.insurance.healthInsurance, HEALTH_INSURANCE_CAP);
  const lifeHealth = Math.min(addMoney(life, health), LIFE_PLUS_HEALTH_CAP);
  const parentHealth = clampMoney(
    profile.insurance.parentHealthInsurance,
    PARENT_HEALTH_INSURANCE_CAP,
  );
  return addMoney(lifeHealth, parentHealth);
}

function investmentDeductions(
  profile: TaxProfile,
  assessableForCap: number,
  overrides?: { rmf?: number; thaiEsg?: number },
) {
  const inv = profile.investment;
  const social = clampMoney(inv.socialSecurity, SOCIAL_SECURITY_CAP);
  const home = clampMoney(inv.homeLoanInterest, HOME_LOAN_INTEREST_CAP);

  const rmfRaw = overrides?.rmf ?? inv.rmf;
  const thaiEsgRaw = overrides?.thaiEsg ?? inv.thaiEsg;

  const rmfCapByIncome = mulRate(assessableForCap, RMF_INCOME_RATE);
  const otherRetirement = addMoney(
    Math.max(0, inv.providentFund),
    Math.max(0, inv.nationalSavingsFund),
  );
  const rmfCapCombined = Math.max(0, subMoney(RETIREMENT_COMBINED_CAP, otherRetirement));
  const rmf = clampMoney(rmfRaw, Math.min(rmfCapByIncome, rmfCapCombined));

  const thaiEsg = clampMoney(
    thaiEsgRaw,
    Math.min(mulRate(assessableForCap, THAI_ESG_INCOME_RATE), THAI_ESG_CAP),
  );

  const pvdCapByIncome = mulRate(assessableForCap, PROVIDENT_FUND_INCOME_RATE);
  const pvdCapCombined = Math.max(
    0,
    subMoney(
      RETIREMENT_COMBINED_CAP,
      addMoney(rmf, Math.max(0, inv.nationalSavingsFund)),
    ),
  );
  const pvd = clampMoney(inv.providentFund, Math.min(pvdCapByIncome, pvdCapCombined));
  const goscoCapCombined = Math.max(0, subMoney(RETIREMENT_COMBINED_CAP, addMoney(rmf, pvd)));
  const gosco = clampMoney(
    inv.nationalSavingsFund,
    Math.min(NATIONAL_SAVINGS_FUND_CAP, goscoCapCombined),
  );

  return {
    total: addMoney(social, home, rmf, thaiEsg, pvd, gosco),
    rmf,
    thaiEsg,
    social,
    home,
    pvd,
    gosco,
  };
}

/**
 * ฐานเพดานบริจาค 10% = เงินได้หลังหักค่าใช้จ่าย − ลดหย่อนทั้งหมดก่อนบริจาค
 * (ส่วนตัว + ประกัน/ลงทุน + มาตรการพิเศษ)
 */
function donationCapBase(
  incomeAfterExpense: number,
  personal: number,
  insurance: number,
  investment: number,
  special: number,
) {
  return Math.max(
    0,
    subMoney(
      incomeAfterExpense,
      addMoney(personal, insurance, investment, special),
    ),
  );
}

function specialDeductionsTotal(profile: TaxProfile) {
  return sumMoneyField(profile.specialDeductions ?? [], "amount");
}

/**
 * เงินบริจาค:
 * - การศึกษา/กีฬา ฯลฯ: หักได้ 2 เท่า ใช้เพดาน 10% ร่วมกับทั่วไป (ใช้โควต้าก่อน)
 * - ทั่วไป: 1 เท่า ใช้เพดาน 10% ที่เหลือ
 * - พรรคการเมือง: สูงสุด 10,000 ไม่นับในเพดาน 10%
 */
function donationDeductions(
  profile: TaxProfile,
  capBase: number,
  overrideGeneral?: number,
) {
  const political = clampMoney(profile.donation.political, POLITICAL_DONATION_CAP);
  const maxDonationPool = mulRate(capBase, DONATION_NET_INCOME_RATE);

  const educationRaw = mulRate(Math.max(0, profile.donation.education), 2);
  const generalRaw = roundMoney(
    Math.max(0, overrideGeneral ?? profile.donation.general),
  );

  const education = Math.min(educationRaw, maxDonationPool);
  const general = Math.min(
    generalRaw,
    Math.max(0, subMoney(maxDonationPool, education)),
  );

  return {
    total: addMoney(political, education, general),
    political,
    education,
    general,
    maxDonationPool,
    educationRaw,
    generalRaw,
  };
}

function resolveTreatments(
  items: Income404Source[],
  forced?: Map<string, "final" | "include">,
): Applied404[] {
  return items.map((item) => {
    const forcedTreatment = forced?.get(item.id);
    if (forcedTreatment) return { ...item, applied: forcedTreatment };
    if (item.treatment === "final" || item.treatment === "include") {
      return { ...item, applied: item.treatment };
    }
    // auto ชั่วคราว — จะถูก optimize ทีหลัง
    return { ...item, applied: "final" as const };
  });
}

function computeCore(
  profile: TaxProfile,
  items404: Applied404[],
): Omit<TaxBreakdown, "decisions404" | "suggestions"> {
  const income401 = sumAmount(profile.income401);
  const income402 = sumAmount(profile.income402);
  const final404 = items404.filter((i) => i.applied === "final");

  const included404Amount = included404Assessable(items404);
  const assessableIncome = addMoney(income401, income402, included404Amount);

  const expense = expense401402(income401, income402);
  const incomeAfterExpense = Math.max(0, subMoney(assessableIncome, expense));

  const personal = personalDeductions(profile);
  const insurance = insuranceDeductions(profile);
  const investment = investmentDeductions(profile, assessableIncome);
  const otherDeductions = addMoney(insurance, investment.total);
  const specialDeduction = specialDeductionsTotal(profile);

  const capBase = donationCapBase(
    incomeAfterExpense,
    personal,
    insurance,
    investment.total,
    specialDeduction,
  );
  const donation = donationDeductions(profile, capBase);

  const netIncome = Math.max(
    0,
    subMoney(
      incomeAfterExpense,
      addMoney(personal, otherDeductions, specialDeduction, donation.total),
    ),
  );

  const { tax: progressive, brackets, marginalRate } = progressiveTax(netIncome);

  // เครดิตภาษีเงินปันผล:
  // - include → อยู่ใน ภ.ง.ด. (ม.47 ทวิ) / ข้อ 13
  // - final → นอก ภ.ง.ด. แต่ยังนับเป็นภาษีที่จ่ายแทนบริษัท / ข้อ 11
  let pndCreditSatang = 0;
  let outsideCreditSatang = 0;
  for (const item of items404) {
    if (item.kind !== "thai_dividend") continue;
    const credit = toSatang(Math.max(0, item.taxCredit));
    if (item.applied === "include") pndCreditSatang += credit;
    else if (item.applied === "final") outsideCreditSatang += credit;
  }
  const dividendTaxCredit = fromSatang(pndCreditSatang);
  const outsideDividendTaxCredit = fromSatang(outsideCreditSatang);

  // ไม่หักเครดิตออกจากภาษีบันไดซ้ำ — เครดิตในแบบอยู่ในยอดหัก ณ ที่จ่ายแล้ว
  const taxAfterCredit = progressive;

  let finalTaxOnlySatang = 0;
  for (const item of final404) {
    finalTaxOnlySatang += toSatang(
      mulRate(Math.max(0, item.amount), FINAL_TAX_RATE[item.kind]),
    );
  }
  // ข้อ 11: หัก ณ ที่จ่ายนอกแบบ (ภาษีสุดท้าย) — เครดิตแยกบรรทัด
  const finalTax = fromSatang(finalTaxOnlySatang);

  // ข้อ 13 ภาษีที่เสียจริง = ในแบบ (ข้อ 10) + นอกแบบ (ข้อ 11+12)
  const totalTax = addMoney(taxAfterCredit, finalTax, outsideDividendTaxCredit);

  // ข้อ 14: หักในแบบเท่านั้น — ไม่รวม 40(4) ที่เลือก final
  const withheldTotal = addMoney(
    sumWithheld(profile.income401),
    sumWithheld(profile.income402),
    withheld404OnForm(items404),
  );

  // ยอดชำระ/คืนตาม ภ.ง.ด. = ภาษีบันได − หักในแบบ (ภาษีสุดท้ายอยู่นอกแบบ)
  const taxPayable = subMoney(taxAfterCredit, withheldTotal);

  return {
    assessableIncome,
    expenseDeduction: expense,
    incomeAfterExpense,
    personalAllowance: personal,
    otherDeductions,
    specialDeduction,
    donationEducation: donation.education,
    donationGeneral: donation.general,
    donationPolitical: donation.political,
    donationDeduction: donation.total,
    donationCapBase: capBase,
    donationMaxPool: donation.maxDonationPool,
    netIncome,
    brackets,
    progressiveTax: progressive,
    dividendTaxCredit,
    outsideDividendTaxCredit,
    taxAfterCredit,
    finalTax,
    totalTax,
    withheldTotal,
    taxPayable,
    marginalRate,
  };
}

/**
 * เงินปันผลไทยที่ใช้เครดิตภาษีต้องเลือกแบบเดียวกันทั้งปี
 * (ป.119/2545 — ห้ามเลือกเฉพาะบางราย)
 */
function applyTreatmentGroup(
  map: Map<string, "final" | "include">,
  items: Income404Source[],
  target: Income404Source,
  treatment: "final" | "include",
) {
  if (target.kind === "thai_dividend") {
    for (const item of items) {
      if (item.kind === "thai_dividend") map.set(item.id, treatment);
    }
    return;
  }
  map.set(target.id, treatment);
}

/** Minimize ภาษีที่ต้องชำระเพิ่ม / maximize ขอคืน — not gross totalTax. */
function scenarioPayable(
  profile: TaxProfile,
  items: Income404Source[],
  forced: Map<string, "final" | "include">,
) {
  return computeCore(profile, resolveTreatments(items, forced)).taxPayable;
}

function optimizeAuto404(
  profile: TaxProfile,
  items: Income404Source[],
): Map<string, "final" | "include"> {
  const autoItems = items.filter((i) => i.treatment === "auto");
  const fixed = new Map<string, "final" | "include">();
  for (const i of items) {
    if (i.treatment === "final" || i.treatment === "include") {
      applyTreatmentGroup(fixed, items, i, i.treatment);
    }
  }

  if (autoItems.length === 0) return fixed;

  // รวมปันผลไทยเป็นหนึ่งหน่วยตัดสินใจ
  const decisionUnits: Income404Source[][] = [];
  const thaiAuto = autoItems.filter((i) => i.kind === "thai_dividend");
  const otherAuto = autoItems.filter((i) => i.kind !== "thai_dividend");
  if (thaiAuto.length > 0) decisionUnits.push(thaiAuto);
  for (const item of otherAuto) decisionUnits.push([item]);

  const n = decisionUnits.length;
  if (n <= 12) {
    let bestMask = 0;
    let bestPayable = Infinity;
    for (let mask = 0; mask < 1 << n; mask++) {
      const forced = new Map(fixed);
      for (let i = 0; i < n; i++) {
        const treatment = mask & (1 << i) ? "include" : "final";
        for (const item of decisionUnits[i]) forced.set(item.id, treatment);
      }
      const payable = scenarioPayable(profile, items, forced);
      if (payable < bestPayable - 1e-9) {
        bestPayable = payable;
        bestMask = mask;
      }
    }
    for (let i = 0; i < n; i++) {
      const treatment = bestMask & (1 << i) ? "include" : "final";
      for (const item of decisionUnits[i]) fixed.set(item.id, treatment);
    }
    return fixed;
  }

  for (const unit of decisionUnits) {
    for (const item of unit) fixed.set(item.id, "final");
  }
  let improved = true;
  while (improved) {
    improved = false;
    let bestUnit = -1;
    let bestPayable = scenarioPayable(profile, items, fixed);
    for (let i = 0; i < n; i++) {
      if (fixed.get(decisionUnits[i][0].id) === "include") continue;
      const trial = new Map(fixed);
      for (const item of decisionUnits[i]) trial.set(item.id, "include");
      const payable = scenarioPayable(profile, items, trial);
      if (payable < bestPayable - 1e-9) {
        bestPayable = payable;
        bestUnit = i;
      }
    }
    if (bestUnit >= 0) {
      for (const item of decisionUnits[bestUnit]) fixed.set(item.id, "include");
      improved = true;
    }
  }
  return fixed;
}

function buildDecisions(
  profile: TaxProfile,
  items: Income404Source[],
  appliedMap: Map<string, "final" | "include">,
): Income404Decision[] {
  const basePayable = scenarioPayable(profile, items, appliedMap);

  return items.map((item) => {
    const applied = appliedMap.get(item.id) ?? "final";
    const rate = FINAL_TAX_RATE[item.kind];
    const finalTaxAmount = mulRate(Math.max(0, item.amount), rate);

    const asFinal = new Map(appliedMap);
    applyTreatmentGroup(asFinal, items, item, "final");
    const asInclude = new Map(appliedMap);
    applyTreatmentGroup(asInclude, items, item, "include");

    const payableFinal = scenarioPayable(profile, items, asFinal);
    const payableInclude = scenarioPayable(profile, items, asInclude);
    const recommended: "final" | "include" =
      payableInclude < payableFinal - 1e-9 ? "include" : "final";

    const optimalPayable = Math.min(payableFinal, payableInclude);
    const savingsIfFollowRecommendation = roundMoney(
      Math.max(0, basePayable - optimalPayable),
    );

    return {
      id: item.id,
      label: item.label,
      kind: item.kind,
      amount: item.amount,
      withheld: item.withheld,
      taxCredit: item.taxCredit,
      treatment: item.treatment,
      recommended,
      applied,
      finalTaxAmount,
      savingsIfFollowRecommendation,
    };
  });
}

function buildSuggestions(
  profile: TaxProfile,
  items404: Applied404[],
  core: Omit<TaxBreakdown, "decisions404" | "suggestions">,
): DeductionSuggestion[] {
  const suggestions: DeductionSuggestion[] = [];
  const assessable = core.assessableIncome;
  const marginal = core.marginalRate;

  // RMF room
  const otherRetirement =
    Math.max(0, profile.investment.providentFund) +
    Math.max(0, profile.investment.nationalSavingsFund);
  const rmfIncomeCap = assessable * RMF_INCOME_RATE;
  const rmfCombinedCap = Math.max(0, RETIREMENT_COMBINED_CAP - otherRetirement);
  const rmfMax = Math.min(rmfIncomeCap, rmfCombinedCap);
  const rmfRoom = Math.max(0, rmfMax - Math.max(0, profile.investment.rmf));

  if (rmfRoom > 0 && marginal > 0) {
    const additional = rmfRoom;
    const withMore = computeCore(profile, items404);
    // recalc with override via temporary profile
    const trialProfile: TaxProfile = {
      ...profile,
      investment: {
        ...profile.investment,
        rmf: profile.investment.rmf + additional,
      },
    };
    const trial = computeCore(trialProfile, items404);
    const saved = Math.max(0, withMore.totalTax - trial.totalTax);
    suggestions.push({
      key: "rmf",
      title: "ลงทุน RMF เพิ่ม",
      room: rmfRoom,
      suggestedAdditional: additional,
      taxSaved: saved,
      note: `วงเงินคงเหลือ ${Math.round(rmfRoom).toLocaleString("th-TH")} บาท (≤ 30% ของเงินได้ และรวมกองทุนเกษียณไม่เกิน 500,000)`,
    });
  }

  // ThaiESG room
  const thaiEsgMax = Math.min(assessable * THAI_ESG_INCOME_RATE, THAI_ESG_CAP);
  const thaiEsgRoom = Math.max(0, thaiEsgMax - Math.max(0, profile.investment.thaiEsg));
  if (thaiEsgRoom > 0 && marginal > 0) {
    const additional = thaiEsgRoom;
    const trialProfile: TaxProfile = {
      ...profile,
      investment: {
        ...profile.investment,
        thaiEsg: profile.investment.thaiEsg + additional,
      },
    };
    const trial = computeCore(trialProfile, items404);
    const saved = Math.max(0, core.totalTax - trial.totalTax);
    suggestions.push({
      key: "thaiEsg",
      title: "ลงทุน ThaiESG เพิ่ม",
      room: thaiEsgRoom,
      suggestedAdditional: additional,
      taxSaved: saved,
      note: `วงเงินคงเหลือ ${Math.round(thaiEsgRoom).toLocaleString("th-TH")} บาท (≤ 30% ของเงินได้ สูงสุด 300,000)`,
    });
  }

  // Donation room (general 1x) — หลังหักมาตรการพิเศษแล้ว
  const personal = personalDeductions(profile);
  const insurance = insuranceDeductions(profile);
  const investment = investmentDeductions(profile, assessable);
  const special = specialDeductionsTotal(profile);
  const capBase = donationCapBase(
    core.incomeAfterExpense,
    personal,
    insurance,
    investment.total,
    special,
  );
  const currentDonation = donationDeductions(profile, capBase);
  const donationRoom = Math.max(
    0,
    subMoney(
      currentDonation.maxDonationPool,
      addMoney(currentDonation.education, currentDonation.general),
    ),
  );
  if (donationRoom > 0 && marginal > 0) {
    const additional = donationRoom;
    const trialProfile: TaxProfile = {
      ...profile,
      donation: {
        ...profile.donation,
        general: profile.donation.general + additional,
      },
    };
    const trial = computeCore(trialProfile, items404);
    const saved = Math.max(0, core.totalTax - trial.totalTax);
    suggestions.push({
      key: "donation",
      title: "บริจาคเพิ่ม (ทั่วไป)",
      room: donationRoom,
      suggestedAdditional: additional,
      taxSaved: saved,
      note: `วงเงินบริจาคทั่วไปคงเหลือ ≈ ${Math.round(donationRoom).toLocaleString("th-TH")} บาท (≤ 10% หลังหักลดหย่อนรวมมาตรการพิเศษ)`,
    });
  }

  return suggestions;
}

export function calculateTax(profile: TaxProfile): TaxBreakdown {
  const appliedMap = optimizeAuto404(profile, profile.income404);
  // merge non-auto
  for (const item of profile.income404) {
    if (item.treatment === "final" || item.treatment === "include") {
      appliedMap.set(item.id, item.treatment);
    }
  }

  const applied = resolveTreatments(profile.income404, appliedMap);
  const core = computeCore(profile, applied);
  const decisions404 = buildDecisions(profile, profile.income404, appliedMap);
  const suggestions = buildSuggestions(profile, applied, core);

  return {
    ...core,
    decisions404,
    suggestions,
  };
}

/** เพดานลงทุน/ลดหย่อนตามเงินได้และรายการเกษียณอื่นที่กรอกแล้ว */
export function investmentMaxima(
  profile: TaxProfile,
  assessableIncome: number,
) {
  const inv = profile.investment;
  const pvd = Math.max(0, inv.providentFund);
  const gosco = Math.max(0, inv.nationalSavingsFund);
  const rmf = Math.max(0, inv.rmf);

  const pvdMax = Math.min(
    mulRate(assessableIncome, PROVIDENT_FUND_INCOME_RATE),
    Math.max(0, subMoney(RETIREMENT_COMBINED_CAP, addMoney(gosco, rmf))),
  );
  const goscoMax = Math.min(
    NATIONAL_SAVINGS_FUND_CAP,
    Math.max(0, subMoney(RETIREMENT_COMBINED_CAP, addMoney(pvd, rmf))),
  );
  const rmfMax = Math.min(
    mulRate(assessableIncome, RMF_INCOME_RATE),
    Math.max(0, subMoney(RETIREMENT_COMBINED_CAP, addMoney(pvd, gosco))),
  );
  const thaiEsgMax = Math.min(
    mulRate(assessableIncome, THAI_ESG_INCOME_RATE),
    THAI_ESG_CAP,
  );

  return {
    socialSecurity: SOCIAL_SECURITY_CAP,
    providentFund: roundMoney(Math.max(0, pvdMax)),
    nationalSavingsFund: roundMoney(Math.max(0, goscoMax)),
    rmf: roundMoney(Math.max(0, rmfMax)),
    thaiEsg: roundMoney(Math.max(0, thaiEsgMax)),
    homeLoanInterest: HOME_LOAN_INTEREST_CAP,
  };
}

export function emptyProfile(taxYear: TaxYear = DEFAULT_TAX_YEAR): TaxProfile {
  return {
    version: 1,
    taxYear,
    name: "",
    updatedAt: new Date().toISOString(),
    income401: [],
    income402: [],
    income404: [],
    personal: {
      spouse: false,
      children: 0,
      childrenBornFrom2561: 0,
      ownParents: 0,
      spouseParents: 0,
      disabledDependents: 0,
    },
    insurance: {
      lifeInsurance: 0,
      healthInsurance: 0,
      parentHealthInsurance: 0,
    },
    investment: {
      socialSecurity: 0,
      providentFund: 0,
      nationalSavingsFund: 0,
      rmf: 0,
      thaiEsg: 0,
      homeLoanInterest: 0,
    },
    specialDeductions: [],
    donation: {
      general: 0,
      education: 0,
      political: 0,
    },
  };
}

export { KIND_404_META };
