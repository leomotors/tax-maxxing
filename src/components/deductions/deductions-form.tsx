"use client";

import { SpecialDeductionsEditor } from "@/components/deductions/special-deductions";
import { MoneyInput } from "@/components/ui/money-input";
import { investmentMaxima } from "@/lib/tax/calculate";
import {
  NATIONAL_SAVINGS_FUND_CAP,
  PROVIDENT_FUND_INCOME_RATE,
  RETIREMENT_COMBINED_CAP,
  RMF_INCOME_RATE,
  SOCIAL_SECURITY_MONTHLY_CAP,
  THAI_ESG_CAP,
  THAI_ESG_INCOME_RATE,
} from "@/lib/tax/constants";
import type { TaxProfile } from "@/lib/tax/types";
import { formatThb } from "@/lib/utils";

function baht(n: number) {
  return formatThb(n, { digits: 0 });
}

export function DeductionsForm({
  profile,
  assessableIncome,
  onChange,
}: {
  profile: TaxProfile;
  /** เงินได้พึงประเมินหลังรวม 40(4) ที่เลือก — ใช้คำนวณเพดานลงทุน */
  assessableIncome: number;
  onChange: (patch: Partial<TaxProfile>) => void;
}) {
  const { personal, insurance, investment, specialDeductions, donation } =
    profile;
  const maxima = investmentMaxima(profile, assessableIncome);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">
          ค่าลดหย่อนส่วนตัว / ครอบครัว
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-3 rounded-[var(--radius)] border border-line-2 bg-surface-2/60 px-3 py-3">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={personal.spouse}
              onChange={(e) =>
                onChange({
                  personal: { ...personal, spouse: e.target.checked },
                })
              }
            />
            <span className="text-sm">
              คู่สมรส (60,000)
              <span className="block text-xs text-ink-3">ไม่มีเงินได้ / รวมยื่น</span>
            </span>
          </label>
          <NumberField
            label="บุตร (เกิดก่อน 2561)"
            value={personal.children}
            onChange={(children) =>
              onChange({ personal: { ...personal, children } })
            }
            hint="คนละ 30,000"
          />
          <NumberField
            label="บุตร (เกิดตั้งแต่ 2561)"
            value={personal.childrenBornFrom2561}
            onChange={(childrenBornFrom2561) =>
              onChange({ personal: { ...personal, childrenBornFrom2561 } })
            }
            hint="คนละ 60,000"
          />
          <NumberField
            label="บิดา/มารดา ของท่าน"
            value={personal.ownParents}
            onChange={(ownParents) =>
              onChange({ personal: { ...personal, ownParents } })
            }
            hint="คนละ 30,000 สูงสุด 2"
          />
          <NumberField
            label="บิดา/มารดา ของคู่สมรส"
            value={personal.spouseParents}
            onChange={(spouseParents) =>
              onChange({ personal: { ...personal, spouseParents } })
            }
            hint="คนละ 30,000 สูงสุด 2"
          />
          <NumberField
            label="อุปการะคนพิการ/ทุพพลภาพ"
            value={personal.disabledDependents}
            onChange={(disabledDependents) =>
              onChange({ personal: { ...personal, disabledDependents } })
            }
            hint="คนละ 60,000"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">
          ประกันภัย
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <MoneyInput
            label="ประกันชีวิต"
            value={insurance.lifeInsurance}
            onChange={(lifeInsurance) =>
              onChange({ insurance: { ...insurance, lifeInsurance } })
            }
            hint="สูงสุด 100,000 (รวมสุขภาพ ≤ 100,000)"
          />
          <MoneyInput
            label="ประกันสุขภาพ"
            value={insurance.healthInsurance}
            onChange={(healthInsurance) =>
              onChange({ insurance: { ...insurance, healthInsurance } })
            }
            hint="สูงสุด 25,000"
          />
          <MoneyInput
            label="ประกันสุขภาพบิดา/มารดา"
            value={insurance.parentHealthInsurance}
            onChange={(parentHealthInsurance) =>
              onChange({ insurance: { ...insurance, parentHealthInsurance } })
            }
            hint="สูงสุด 15,000"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">
          การลงทุน / กองทุน / ดอกเบี้ยบ้าน — จุด Tax-Maxxing
        </h3>
        <p className="mb-3 text-sm text-ink-3">
          ตัวเลข &quot;ลงทุนได้สูงสุด&quot; คำนวณจากเงินได้พึงประเมินปัจจุบันและรายการเกษียณอื่นที่กรอกแล้ว
          (กลุ่มเกษียณรวมกันไม่เกิน {baht(RETIREMENT_COMBINED_CAP)})
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MoneyInput
            label="ประกันสังคม"
            value={investment.socialSecurity}
            onChange={(socialSecurity) =>
              onChange({ investment: { ...investment, socialSecurity } })
            }
            hint={`สูงสุด ${baht(maxima.socialSecurity)} (${baht(SOCIAL_SECURITY_MONTHLY_CAP)}×12 · ปี 2569)`}
          />
          <MoneyInput
            label="กองทุนสำรองเลี้ยงชีพ / กบข."
            value={investment.providentFund}
            onChange={(providentFund) =>
              onChange({ investment: { ...investment, providentFund } })
            }
            hint={`ลงทุนได้สูงสุด ${baht(maxima.providentFund)} (≤ ${(PROVIDENT_FUND_INCOME_RATE * 100).toFixed(0)}% ของเงินได้ · รวมเกษียณ ≤ ${baht(RETIREMENT_COMBINED_CAP)})`}
          />
          <MoneyInput
            label="กอช."
            value={investment.nationalSavingsFund}
            onChange={(nationalSavingsFund) =>
              onChange({ investment: { ...investment, nationalSavingsFund } })
            }
            hint={`ลงทุนได้สูงสุด ${baht(maxima.nationalSavingsFund)} (เพดาน ${baht(NATIONAL_SAVINGS_FUND_CAP)} · รวมเกษียณ ≤ ${baht(RETIREMENT_COMBINED_CAP)})`}
          />
          <MoneyInput
            label="RMF"
            value={investment.rmf}
            onChange={(rmf) => onChange({ investment: { ...investment, rmf } })}
            hint={`ลงทุนได้สูงสุด ${baht(maxima.rmf)} (≤ ${(RMF_INCOME_RATE * 100).toFixed(0)}% ของเงินได้ · รวมเกษียณ ≤ ${baht(RETIREMENT_COMBINED_CAP)})`}
          />
          <MoneyInput
            label="ThaiESG"
            value={investment.thaiEsg}
            onChange={(thaiEsg) =>
              onChange({ investment: { ...investment, thaiEsg } })
            }
            hint={`ลงทุนได้สูงสุด ${baht(maxima.thaiEsg)} (≤ ${(THAI_ESG_INCOME_RATE * 100).toFixed(0)}% ของเงินได้ · สูงสุด ${baht(THAI_ESG_CAP)} · แยกจากกลุ่มเกษียณ)`}
          />
          <MoneyInput
            label="ดอกเบี้ยบ้าน"
            value={investment.homeLoanInterest}
            onChange={(homeLoanInterest) =>
              onChange({ investment: { ...investment, homeLoanInterest } })
            }
            hint={`สูงสุด ${baht(maxima.homeLoanInterest)}`}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">
          ลดหย่อนมาตรการพิเศษ / อื่น ๆ
        </h3>
        <SpecialDeductionsEditor
          items={specialDeductions ?? []}
          onChange={(next) => onChange({ specialDeductions: next })}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-2 uppercase">
          เงินบริจาค
        </h3>
        <p className="mb-3 text-sm text-ink-3">
          เพดาน 10% คำนวณจากเงินได้หลังหักค่าใช้จ่ายและลดหย่อนทั้งหมดก่อนบริจาค
          (รวมมาตรการพิเศษ) — การศึกษา/กีฬาใช้โควต้าก่อน แล้วค่อยทั่วไป
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <MoneyInput
            label="บริจาคการศึกษา / กีฬา ฯลฯ"
            value={donation.education}
            onChange={(education) =>
              onChange({ donation: { ...donation, education } })
            }
            hint="กรอกยอดจริง — ระบบคูณ 2 ให้ (ใช้เพดาน 10% ก่อน)"
          />
          <MoneyInput
            label="บริจาคทั่วไป"
            value={donation.general}
            onChange={(general) =>
              onChange({ donation: { ...donation, general } })
            }
            hint="1 เท่า — ใช้เพดาน 10% ที่เหลือหลังการศึกษา/กีฬา"
          />
          <MoneyInput
            label="พรรคการเมือง"
            value={donation.political}
            onChange={(political) =>
              onChange({ donation: { ...donation, political } })
            }
            hint="สูงสุด 10,000 — ไม่นับในเพดาน 10%"
          />
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <input
        type="number"
        min={0}
        className="number-input w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}
