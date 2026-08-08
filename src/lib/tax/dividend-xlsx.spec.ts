import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  classifyDividendHeader,
  parseDividendTaxXlsx,
} from "./dividend-xlsx";

describe("classifyDividendHeader", () => {
  it("detects CIT credit columns", () => {
    expect(
      classifyDividendHeader("จำนวนเงินปันผล จากกิจการที่เสียภาษีร้อยละ 20"),
    ).toEqual({ type: "credit", citPercent: 20, rateLabel: "20%" });
    expect(
      classifyDividendHeader("จำนวนเงินปันผล จากกิจการที่เสียภาษีร้อยละ 12.5"),
    ).toEqual({ type: "credit", citPercent: 12.5, rateLabel: "12.5%" });
  });

  it("skips interest and non-amount headers", () => {
    expect(classifyDividendHeader("จำนวนดอกเบี้ยหุ้นกู้")).toEqual({
      type: "skip",
    });
    expect(
      classifyDividendHeader("ภาษีของเงินปันผล จากกิจการที่เสียภาษีร้อยละ 20"),
    ).toEqual({ type: "skip" });
  });

  it("treats accounting-profit dividends as no-credit amounts", () => {
    expect(
      classifyDividendHeader("จำนวนเงินปันผล จากกำไรที่รับรู้ทางบัญชี"),
    ).toEqual({
      type: "no_credit",
      rateLabel: "ไม่มีเครดิต (กำไรทางบัญชี)",
    });
  });
});

function buildSyntheticWorkbook(): ArrayBuffer {
  // Synthetic fixtures only — never copy real symbols, amounts, or tax IDs.
  const header = [
    "ประเภทหลักทรัพย์",
    "ชื่อย่อหลักทรัพย์",
    "เลขประจำตัวผู้เสียภาษี ของผู้จ่ายเงินปันผล",
    "วันที่จ่าย",
    "เลขทะเบียนผู้ถือหุ้น",
    "จำนวนเงินปันผล จากกิจการที่เสียภาษีร้อยละ 20",
    "ภาษีของเงินปันผล จากกิจการที่เสียภาษีร้อยละ 20",
    "จำนวนเงินปันผล จากกำไรที่รับรู้ทางบัญชี",
    "ภาษีของเงินปันผล จากกำไรที่รับรู้ทางบัญชี",
    "จำนวนดอกเบี้ยหุ้นกู้",
    "ภาษีของดอกเบี้ยหุ้นกู้",
  ];

  const rows = [
    header,
    ["01", "STOCKA", "0100000000000", "2026-05-01", "1", 1000, 100, 0, 0, 999, 99.9],
    ["01", "STOCKB", "0100000000001", "2026-05-02", "1", 800, 80, 200, 20, 0, 0],
    ["01", "STOCKA", "0100000000000", "2026-09-01", "1", 500, 50, 0, 0, 0, 0],
    ["หมายเหตุ : คำอธิบายประเภทหลักทรัพย์"],
    ["01", "คำอธิบาย"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "TAX sheet");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseDividendTaxXlsx", () => {
  it("aggregates by symbol and computes ม.47 ทวิ credit from CIT rate", () => {
    const result = parseDividendTaxXlsx(buildSyntheticWorkbook());

    // STOCKA: (1000+500) @20% credit = 1500 * 20/80 = 375; WHT 150
    // STOCKB: 800 @20% credit = 200; + 200 no-credit; WHT 100
    // Debenture interest excluded
    expect(result.bySymbol).toEqual([
      {
        symbol: "STOCKA",
        dividend: 1500,
        withheld: 150,
        taxCredit: 375,
        citRates: ["20%"],
      },
      {
        symbol: "STOCKB",
        dividend: 1000,
        withheld: 100,
        taxCredit: 200,
        citRates: ["20%", "ไม่มีเครดิต (กำไรทางบัญชี)"],
      },
    ]);
    expect(result.dividend).toBe(2500);
    expect(result.withheld).toBe(250);
    expect(result.taxCredit).toBe(575);
    expect(result.rowCount).toBe(3);
  });
});
