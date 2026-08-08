import { describe, expect, it } from "vitest";

import { addMoney, subMoney } from "@/lib/money";

import {
  calculateTax,
  emptyProfile,
  expense401402,
  progressiveTax,
} from "./calculate";

describe("progressiveTax", () => {
  it("returns 0 under 150,000", () => {
    expect(progressiveTax(150_000).tax).toBe(0);
  });

  it("applies 5% on the second bracket", () => {
    // 150k @0% + 50k @5% = 2,500
    expect(progressiveTax(200_000).tax).toBe(2_500);
  });
});

describe("expense401402", () => {
  it("floors expense to satang: 1.23 → expense 0.61, remainder 0.62", () => {
    expect(expense401402(1.23, 0)).toBe(0.61);
    expect(subMoney(1.23, expense401402(1.23, 0))).toBe(0.62);
  });

  it("caps at 100,000", () => {
    expect(expense401402(600_000, 0)).toBe(100_000);
  });
});

describe("donations and special deductions", () => {
  it("applies special deductions before donation 10% cap", () => {
    const profile = emptyProfile();
    // หลังค่าใช้จ่าย 100k: assessable 300k - expense 100k = 200k
    profile.income401 = [
      { id: "1", label: "Job", amount: 300_000, withheld: 0 },
    ];
    // personal 60k → cap base without special = 140k → 10% = 14k
    // with special 40k → cap base = 100k → 10% = 10k
    profile.specialDeductions = [
      { id: "s1", label: "Easy E-Receipt", amount: 40_000 },
    ];
    profile.donation = {
      education: 0,
      general: 50_000,
      political: 0,
    };

    const result = calculateTax(profile);
    expect(result.specialDeduction).toBe(40_000);
    expect(result.donationCapBase).toBe(100_000);
    expect(result.donationMaxPool).toBe(10_000);
    expect(result.donationGeneral).toBe(10_000);
    expect(result.donationEducation).toBe(0);
  });

  it("uses education 2x first within the shared 10% pool", () => {
    const profile = emptyProfile();
    profile.income401 = [
      { id: "1", label: "Job", amount: 300_000, withheld: 0 },
    ];
    // after expense 100k, personal 60k → cap base 140k → pool 14k
    profile.donation = {
      education: 5_000, // ×2 = 10_000
      general: 20_000,
      political: 3_000,
    };

    const result = calculateTax(profile);
    expect(result.donationEducation).toBe(10_000);
    expect(result.donationGeneral).toBe(4_000); // 14k - 10k
    expect(result.donationPolitical).toBe(3_000);
    expect(result.donationDeduction).toBe(17_000);
  });
});

describe("money consistency", () => {
  it("keeps assessable equal to 40(1)+40(2)+grossed-up 40(4)", () => {
    const profile = emptyProfile();
    profile.income401 = [
      { id: "1", label: "A", amount: 12345.67, withheld: 100.01 },
      { id: "2", label: "B", amount: 89012.34, withheld: 200.02 },
    ];
    profile.income402 = [
      { id: "3", label: "C", amount: 0.01, withheld: 0 },
      { id: "4", label: "D", amount: 0.02, withheld: 0 },
    ];
    profile.income404 = [
      {
        id: "d1",
        label: "ปันผล",
        kind: "thai_dividend",
        amount: 80_000.05,
        withheld: 8_000.01,
        taxCredit: 20_000.01,
        treatment: "include",
      },
      {
        id: "i1",
        label: "ดอกเบี้ย",
        kind: "interest",
        amount: 1.23,
        withheld: 0.18,
        taxCredit: 0,
        treatment: "final",
      },
    ];

    const result = calculateTax(profile);
    const expected401 = addMoney(12345.67, 89012.34);
    const expected402 = addMoney(0.01, 0.02);
    const expected404 = addMoney(80_000.05, 20_000.01); // gross-up
    const expectedAssessable = addMoney(expected401, expected402, expected404);

    expect(result.assessableIncome).toBe(expectedAssessable);
    expect(result.expenseDeduction).toBe(
      expense401402(expected401, expected402),
    );
    expect(result.incomeAfterExpense).toBe(
      subMoney(expectedAssessable, result.expenseDeduction),
    );
    expect(
      addMoney(result.expenseDeduction, result.incomeAfterExpense),
    ).toBe(expectedAssessable);
  });

});

describe("calculateTax", () => {
  it("deducts personal allowance and 40(1) expense cap", () => {
    const profile = emptyProfile();
    profile.income401 = [
      { id: "1", label: "Job", amount: 600_000, withheld: 20_000 },
    ];

    const result = calculateTax(profile);
    expect(result.expenseDeduction).toBe(100_000);
    expect(result.personalAllowance).toBe(60_000);
    expect(result.netIncome).toBe(440_000);
  });

  it("grosses up thai dividend credit into income and prepaid tax", () => {
    const profile = emptyProfile();
    // เงินได้ต่ำมาก เพื่อให้ภาษีบันได = 0 หลังหักลดหย่อน
    profile.income401 = [
      { id: "1", label: "Job", amount: 100_000, withheld: 0 },
    ];
    profile.income404 = [
      {
        id: "d1",
        label: "ปันผล",
        kind: "thai_dividend",
        amount: 80_000,
        withheld: 8_000,
        taxCredit: 20_000,
        treatment: "include",
      },
    ];

    const result = calculateTax(profile);
    // เงินได้ = 100k + (80k+20k credit) = 200k
    expect(result.assessableIncome).toBe(200_000);
    expect(result.dividendTaxCredit).toBe(20_000);
    // หัก ณ ที่จ่าย = 8k + 20k credit
    expect(result.withheldTotal).toBe(28_000);
    // ไม่หักเครดิตออกจากภาษีบันไดซ้ำ
    expect(result.taxAfterCredit).toBe(result.progressiveTax);
  });

  it("prefers final tax for interest when marginal rate is high", () => {
    const profile = emptyProfile();
    profile.income401 = [
      { id: "1", label: "Job", amount: 3_000_000, withheld: 0 },
    ];
    profile.income404 = [
      {
        id: "i1",
        label: "ดอกเบี้ย",
        kind: "interest",
        amount: 100_000,
        withheld: 15_000,
        taxCredit: 0,
        treatment: "auto",
      },
    ];

    const result = calculateTax(profile);
    expect(result.decisions404[0].recommended).toBe("final");
    expect(result.decisions404[0].applied).toBe("final");
  });

  it("prefers include for interest when marginal rate is low", () => {
    const profile = emptyProfile();
    profile.income401 = [
      { id: "1", label: "Job", amount: 200_000, withheld: 0 },
    ];
    profile.income404 = [
      {
        id: "i1",
        label: "ดอกเบี้ย",
        kind: "interest",
        amount: 20_000,
        withheld: 3_000,
        taxCredit: 0,
        treatment: "auto",
      },
    ];

    const result = calculateTax(profile);
    expect(result.decisions404[0].recommended).toBe("include");
    expect(result.decisions404[0].applied).toBe("include");
  });
});
