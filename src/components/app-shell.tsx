"use client";

import { useRef } from "react";
import {
  Download,
  RotateCcw,
  Upload,
  Calculator,
  Landmark,
  PiggyBank,
  Sparkles,
} from "lucide-react";

import { DeductionsForm } from "@/components/deductions/deductions-form";
import { ExpenseSummary } from "@/components/income/expense-summary";
import { Income401402Editor } from "@/components/income/income-401-402";
import { Income404Editor } from "@/components/income/income-404";
import { MaxxingPanel } from "@/components/summary/maxxing-panel";
import { BracketTable, PndTable } from "@/components/summary/pnd-table";
import { ResultHero } from "@/components/summary/result-hero";
import { Button } from "@/components/ui/button";
import { Badge, Section } from "@/components/ui/section";
import { useTaxProfile } from "@/hooks/use-tax-profile";
import { addMoney, subMoney } from "@/lib/money";
import { expense401402 } from "@/lib/tax/calculate";
import { INCOME_SECTION_META } from "@/lib/tax/constants";

const NAV = [
  { href: "#income", label: "เงินได้", icon: Landmark },
  { href: "#deductions", label: "ลดหย่อน", icon: PiggyBank },
  { href: "#maxxing", label: "Maxxing", icon: Sparkles },
  { href: "#summary", label: "สรุปภาษี", icon: Calculator },
];

export function AppShell() {
  const { profile, setProfile, breakdown, reset, download, upload } =
    useTaxProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const income401 = addMoney(
    ...profile.income401.map((i) => Math.max(0, i.amount)),
  );
  const income402 = addMoney(
    ...profile.income402.map((i) => Math.max(0, i.amount)),
  );
  const income401402 = addMoney(income401, income402);
  const expense401402Amount = expense401402(income401, income402);
  const remaining401402 = subMoney(income401402, expense401402Amount);

  return (
    <div className="bg-mesh min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-ink">
              TM
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight">Tax-Maxxing</p>
              <p className="text-xs text-ink-3">ลดภาษีอย่างมีหลักการ · ปีภาษี {profile.taxYear}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-2 transition hover:bg-accent-soft hover:text-accent"
              >
                <item.icon className="size-3.5" />
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[10rem] flex-1 items-center gap-2 sm:max-w-[14rem] sm:flex-none">
              <span className="sr-only">ชื่อไฟล์</span>
              <input
                type="text"
                value={profile.name}
                placeholder="ชื่อไฟล์ JSON"
                className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                onChange={(e) => setProfile({ name: e.target.value })}
              />
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
            <Button type="button" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              โหลด JSON
            </Button>
            <Button type="button" onClick={download}>
              <Download className="size-4" />
              บันทึก JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm("ล้างข้อมูลทั้งหมดในเครื่องนี้?")) reset();
              }}
            >
              <RotateCcw className="size-4" />
              ล้าง
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex items-stretch gap-6">
          <div className="min-w-0 flex-1 space-y-6 xl:max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-sm font-medium tracking-[0.18em] text-accent uppercase">
                Tax-Maxxing
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                คำนวณภาษีบุคคลธรรมดา
                <span className="text-accent"> ให้เหลือให้น้อยที่สุด</span>
              </h1>
              <p className="mt-3 text-ink-2">
                กรอกเงินได้และค่าลดหย่อน ระบบช่วยเลือก 40(4) ระหว่างภาษีสุดท้ายกับบันได
                และแนะนำวงเงิน RMF / ThaiESG / บริจาค — ข้อมูลเก็บในเครื่องคุณเท่านั้น
              </p>
            </div>

            <div ref={heroRef} className="xl:hidden">
              <ResultHero breakdown={breakdown} />
            </div>

            <Section
              id="income"
              title="เงินได้พึงประเมิน"
              description="รองรับหลายแหล่งต่อประเภท เช่น เงินเดือนจากหลายบริษัท"
              badge={<Badge>ม.40(1) · 40(2) · 40(4)</Badge>}
            >
              <div className="space-y-8">
                <div>
                  <h3 className="mb-1 font-semibold">
                    มาตรา 40(1) และ 40(2) เงินได้จากงานจ้าง / ค่านายหน้า
                  </h3>
                  <p className="mb-3 text-sm text-ink-3">
                    ใน ภ.ง.ด.90/91 รวมคำนวณด้วยกัน — หักค่าใช้จ่ายเหมา 50% สูงสุด 100,000
                    จากยอดรวมทั้งสองมาตรา
                  </p>
                  <Income401402Editor
                    income401={profile.income401}
                    income402={profile.income402}
                    onChange={(next) => setProfile(next)}
                  />
                  <ExpenseSummary
                    ruleLabel={INCOME_SECTION_META["40_1"].expenseLabel}
                    income={income401402}
                    expense={expense401402Amount}
                    remaining={remaining401402}
                  />
                </div>

                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{INCOME_SECTION_META["40_4"].title}</h3>
                    <Badge tone="mint">Maxxing</Badge>
                  </div>
                  <p className="mb-3 text-sm text-ink-3">
                    {INCOME_SECTION_META["40_4"].description}
                  </p>
                  <Income404Editor
                    sources={profile.income404}
                    decisions={breakdown.decisions404}
                    onChange={(income404) => setProfile({ income404 })}
                  />
                  <ExpenseSummary
                    ruleLabel={INCOME_SECTION_META["40_4"].expenseLabel}
                    none
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(["40_3", "40_5", "40_6", "40_7", "40_8"] as const).map((key) => {
                    const meta = INCOME_SECTION_META[key];
                    return (
                      <div
                        key={key}
                        className="rounded-[var(--radius)] border border-dashed border-line bg-surface-2/50 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-ink-2">{meta.short}</p>
                          <Badge tone="muted">เร็วๆ นี้</Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-3">{meta.title}</p>
                        <ExpenseSummary
                          ruleLabel={meta.expenseLabel}
                          pending
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section
              id="deductions"
              title="ค่าลดหย่อน"
              description="กรอกยอดที่จ่ายจริง ระบบจะตัดเพดานตามกฎหมายให้อัตโนมัติ"
            >
              <DeductionsForm
                profile={profile}
                assessableIncome={breakdown.assessableIncome}
                onChange={setProfile}
              />
            </Section>

            <Section
              id="maxxing"
              title="Tax-Maxxing"
              description="แนะนำการเลือก 40(4) และวงเงินลงทุน/บริจาคที่ยังช่วยลดภาษีได้"
              badge={<Badge tone="mint">Core</Badge>}
            >
              <MaxxingPanel breakdown={breakdown} />
            </Section>

            <Section
              id="summary"
              title="ตารางคำนวณภาษี"
              description="สรุปลำดับรายการใกล้เคียง ภ.ง.ด.90/91 สำหรับตรวจสอบก่อนยื่น"
            >
              <div className="space-y-6">
                <PndTable breakdown={breakdown} />
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink">ภาษีแบบขั้นบันได</h3>
                  <BracketTable breakdown={breakdown} />
                </div>
              </div>
            </Section>

            <footer className="border-t border-line pt-6 pb-24 text-center text-xs text-ink-3 xl:pb-10">
              Tax-Maxxing เป็นเครื่องมือประมาณการ ไม่ใช่คำปรึกษาทางภาษี —
              โปรดตรวจสอบกับกรมสรรพากรหรือผู้ประกอบวิชาชีพก่อนยื่นแบบ
              · ข้อมูลบันทึกใน localStorage ของเบราว์เซอร์นี้
            </footer>
          </div>

          <ResultHero breakdown={breakdown} variant="rail" />
        </div>

        <ResultHero
          breakdown={breakdown}
          variant="float"
          anchorRef={heroRef}
        />
      </main>
    </div>
  );
}
