"use client";

import type { TaxBreakdown } from "@/lib/tax/types";
import { formatThb } from "@/lib/utils";

function Row({
  label,
  value,
  strong,
  muted,
  indent,
}: {
  label: string;
  value: number | string;
  strong?: boolean;
  muted?: boolean;
  indent?: boolean;
}) {
  return (
    <tr className={strong ? "bg-accent-soft/40" : undefined}>
      <td
        className={`py-2.5 pr-3 ${indent ? "pl-6 text-ink-2" : "pl-3"} ${strong ? "font-semibold text-ink" : ""} ${muted ? "text-ink-3" : ""}`}
      >
        {label}
      </td>
      <td
        className={`px-3 py-2.5 text-right tabular-nums ${strong ? "font-semibold" : "font-medium"}`}
      >
        {typeof value === "number" ? formatThb(value) : value}
      </td>
    </tr>
  );
}

export function PndTable({ breakdown }: { breakdown: TaxBreakdown }) {
  const b = breakdown;
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-line">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left text-ink-2">
            <th className="px-3 py-2.5 font-medium">รายการ (สรุปแบบ ภ.ง.ด.90/91)</th>
            <th className="px-3 py-2.5 text-right font-medium">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-2">
          <Row
            label="1. เงินได้พึงประเมินที่นำมารวมคำนวณ"
            value={b.assessableIncome}
          />
          {b.dividendTaxCredit > 0 ? (
            <Row
              label="  รวมเครดิตภาษีเงินปันผล (ม.47 ทวิ) ที่ gross-up เป็นเงินได้"
              value={b.dividendTaxCredit}
              muted
              indent
            />
          ) : null}
          <Row label="2. หัก ค่าใช้จ่าย" value={b.expenseDeduction} indent />
          <Row label="3. คงเหลือ" value={b.incomeAfterExpense} strong />
          <Row
            label="4. หัก ค่าลดหย่อนส่วนตัว/ครอบครัว"
            value={b.personalAllowance}
            indent
          />
          <Row
            label="5. หัก ค่าลดหย่อนอื่น (ประกัน/ลงทุน ฯลฯ)"
            value={b.otherDeductions}
            indent
          />
          <Row
            label="6. หัก ค่าลดหย่อนมาตรการพิเศษ / อื่น ๆ"
            value={b.specialDeduction}
            indent
          />
          <Row
            label="7. หัก เงินบริจาคเพื่อการศึกษา / กีฬา ฯลฯ (2 เท่า)"
            value={b.donationEducation}
            indent
          />
          <Row
            label="8. หัก เงินบริจาคทั่วไป (1 เท่า)"
            value={b.donationGeneral}
            indent
          />
          {b.donationPolitical > 0 ? (
            <Row
              label="  หัก บริจาคพรรคการเมือง"
              value={b.donationPolitical}
              muted
              indent
            />
          ) : null}
          {b.donationMaxPool > 0 || b.donationDeduction > 0 ? (
            <Row
              label="  เพดานบริจาค 10% (การศึกษา+ทั่วไป)"
              value={b.donationMaxPool}
              muted
              indent
            />
          ) : null}
          <Row label="9. เงินได้สุทธิ" value={b.netIncome} strong />
          <Row label="10. ภาษีคำนวณจากเงินได้สุทธิ" value={b.progressiveTax} />
          <Row label="11. ภาษีสุดท้ายจาก 40(4)" value={b.finalTax} indent />
          <Row label="12. ภาษีที่ต้องเสียทั้งสิ้น" value={b.totalTax} strong />
          <Row
            label="13. หัก ภาษีหัก ณ ที่จ่าย / เครดิตภาษี"
            value={b.withheldTotal}
            indent
          />
          {b.dividendTaxCredit > 0 ? (
            <Row
              label="  ในนั้นเป็นเครดิตภาษีเงินปันผล (นับเป็นภาษีที่จ่ายแล้ว)"
              value={b.dividendTaxCredit}
              muted
              indent
            />
          ) : null}
          <Row
            label={
              b.taxPayable >= 0
                ? "14. ภาษีที่ต้องชำระเพิ่ม"
                : "14. ภาษีชำระไว้เกิน (ขอคืน)"
            }
            value={Math.abs(b.taxPayable)}
            strong
          />
        </tbody>
      </table>
    </div>
  );
}

export function BracketTable({ breakdown }: { breakdown: TaxBreakdown }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-line">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left text-ink-2">
            <th className="px-3 py-2.5 font-medium">ขั้นเงินได้สุทธิ</th>
            <th className="px-3 py-2.5 text-right font-medium">อัตรา</th>
            <th className="px-3 py-2.5 text-right font-medium">เงินได้ในขั้น</th>
            <th className="px-3 py-2.5 text-right font-medium">ภาษี</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-2">
          {breakdown.brackets.map((row) => {
            const inactive = row.taxable <= 0;
            return (
              <tr
                key={`${row.from}-${row.to}-${row.rate}`}
                className={inactive ? "bg-surface-2/60 text-ink-3" : undefined}
              >
                <td className="px-3 py-2">
                  {formatThb(row.from, { digits: 0 })}
                  {" – "}
                  {row.to == null ? "ขึ้นไป" : formatThb(row.to, { digits: 0 })}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {(row.rate * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatThb(row.taxable)}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${inactive ? "" : "font-medium"}`}
                >
                  {formatThb(row.tax)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
