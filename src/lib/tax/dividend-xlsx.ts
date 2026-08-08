import * as XLSX from "xlsx";

import { addMoney, roundMoney } from "@/lib/money";

/** Per-symbol footnote from Excel import (not used in tax engine totals). */
export interface DividendSymbolBreakdown {
  symbol: string;
  dividend: number;
  withheld: number;
  taxCredit: number;
  citRates: string[];
}

export interface DividendXlsxImportResult {
  dividend: number;
  withheld: number;
  taxCredit: number;
  bySymbol: DividendSymbolBreakdown[];
  rowCount: number;
}

type MoneyPairKind =
  | { type: "credit"; citPercent: number; rateLabel: string }
  | { type: "no_credit"; rateLabel: string }
  | { type: "skip" };

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function noCreditLabel(header: string): string {
  const h = header.replace(/\s+/g, " ");
  if (h.includes("BOI")) return "ไม่มีเครดิต (BOI)";
  if (h.includes("กำไรที่รับรู้ทางบัญชี")) return "ไม่มีเครดิต (กำไรทางบัญชี)";
  if (h.includes("หักผลขาดทุน")) return "ไม่มีเครดิต (หักขาดทุน)";
  if (h.includes("เงินส่วนแบ่งของกำไร") || h.includes("จากเงินปันผล หรือ")) {
    return "ไม่มีเครดิต (ปันผลซ้อน)";
  }
  if (h.includes("ไม่ได้รับเครดิต")) return "ไม่มีเครดิต";
  if (h.includes("ยกเว้นภาษี")) return "ไม่มีเครดิต (ยกเว้น)";
  if (h.includes("อัตราอื่น")) return "เครดิตอัตราอื่น (ไม่ระบุ %)";
  return "ไม่มีเครดิต";
}

/** Classify a header cell that starts a (จำนวนเงิน, ภาษี) pair. */
export function classifyDividendHeader(header: string): MoneyPairKind {
  const h = header.replace(/\s+/g, " ").trim();
  if (!h) return { type: "skip" };

  if (h.includes("ดอกเบี้ยหุ้นกู้")) return { type: "skip" };
  if (h.includes("เทียบเท่าเงินปันผล")) return { type: "skip" };
  if (h.includes("Exercise") || h.includes("DW")) return { type: "skip" };

  if (!h.startsWith("จำนวน")) return { type: "skip" };

  const rateMatch = h.match(/เสียภาษีร้อยละ\s*([0-9]+(?:\.[0-9]+)?)/);
  if (rateMatch) {
    const citPercent = Number(rateMatch[1]);
    return {
      type: "credit",
      citPercent,
      rateLabel: `${citPercent}%`,
    };
  }

  if (h.includes("ได้รับเครติตภาษี") || h.includes("ได้รับเครดิตภาษี")) {
    return { type: "no_credit", rateLabel: noCreditLabel(h) };
  }

  if (h.includes("เงินปันผล") || h.includes("มาตรา 40(4)(ง)")) {
    return { type: "no_credit", rateLabel: noCreditLabel(h) };
  }

  return { type: "skip" };
}

function taxCreditFromCit(dividend: number, citPercent: number): number {
  if (dividend <= 0 || citPercent <= 0 || citPercent >= 100) return 0;
  return roundMoney((dividend * citPercent) / (100 - citPercent));
}

function isDataRow(row: unknown[]): boolean {
  const typeCode = str(row[0]);
  const symbol = str(row[1]);
  if (!symbol) return false;
  if (typeCode.includes("หมายเหตุ") || symbol.includes("หมายเหตุ")) return false;
  if (typeCode === "ประเภทหลักทรัพย์" || symbol === "คำอธิบาย") return false;
  if (!/^\d{2}$/.test(typeCode)) return false;
  return true;
}

function mergeRateLabels(existing: string[], next: string): string[] {
  if (existing.includes(next)) return existing;
  return [...existing, next].sort((a, b) => a.localeCompare(b, "th"));
}

/**
 * Parse TSD/broker "TAX sheet" style dividend workbook.
 * Totals = sum of dividend amounts (gross, not net of WHT), sum of WHT, sum of ม.47 ทวิ credits.
 */
export function parseDividendTaxXlsx(data: ArrayBuffer): DividendXlsxImportResult {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => /tax/i.test(n)) ?? wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("ไม่พบชีตในไฟล์ Excel");
  }

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (rows.length < 2) {
    throw new Error("ไฟล์ไม่มีข้อมูล");
  }

  const header = (rows[0] ?? []).map((c) => str(c));
  const pairs: { amountIdx: number; taxIdx: number; kind: MoneyPairKind }[] = [];

  for (let i = 0; i < header.length; i++) {
    const kind = classifyDividendHeader(header[i]);
    if (kind.type === "skip") continue;
    const taxIdx = i + 1;
    if (taxIdx >= header.length) continue;
    if (!header[taxIdx].startsWith("ภาษี")) continue;
    pairs.push({ amountIdx: i, taxIdx, kind });
  }

  if (pairs.length === 0) {
    throw new Error("ไม่พบคอลัมน์เงินปันผลในรูปแบบที่รองรับ");
  }

  const bySymbolMap = new Map<
    string,
    { dividend: number; withheld: number; taxCredit: number; citRates: string[] }
  >();

  let rowCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (!isDataRow(row)) continue;
    rowCount += 1;
    const symbol = str(row[1]);

    let dividend = 0;
    let withheld = 0;
    let taxCredit = 0;
    let citRates: string[] = [];

    for (const pair of pairs) {
      const amount = Math.max(0, num(row[pair.amountIdx]));
      const tax = Math.max(0, num(row[pair.taxIdx]));
      if (amount <= 0 && tax <= 0) continue;

      dividend = addMoney(dividend, amount);
      withheld = addMoney(withheld, tax);

      if (pair.kind.type === "credit") {
        taxCredit = addMoney(
          taxCredit,
          taxCreditFromCit(amount, pair.kind.citPercent),
        );
        citRates = mergeRateLabels(citRates, pair.kind.rateLabel);
      } else if (pair.kind.type === "no_credit") {
        citRates = mergeRateLabels(citRates, pair.kind.rateLabel);
      }
    }

    if (dividend === 0 && withheld === 0 && taxCredit === 0) continue;

    const prev = bySymbolMap.get(symbol) ?? {
      dividend: 0,
      withheld: 0,
      taxCredit: 0,
      citRates: [],
    };
    bySymbolMap.set(symbol, {
      dividend: addMoney(prev.dividend, dividend),
      withheld: addMoney(prev.withheld, withheld),
      taxCredit: addMoney(prev.taxCredit, taxCredit),
      citRates: citRates.reduce(
        (acc, label) => mergeRateLabels(acc, label),
        prev.citRates,
      ),
    });
  }

  const bySymbol: DividendSymbolBreakdown[] = [...bySymbolMap.entries()]
    .map(([symbol, v]) => ({ symbol, ...v }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol, "en"));

  const totals = bySymbol.reduce(
    (acc, row) => ({
      dividend: addMoney(acc.dividend, row.dividend),
      withheld: addMoney(acc.withheld, row.withheld),
      taxCredit: addMoney(acc.taxCredit, row.taxCredit),
    }),
    { dividend: 0, withheld: 0, taxCredit: 0 },
  );

  if (rowCount === 0 || bySymbol.length === 0) {
    throw new Error("ไม่พบแถวเงินปันผลในไฟล์");
  }

  return {
    ...totals,
    bySymbol,
    rowCount,
  };
}
