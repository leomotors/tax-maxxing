import { describe, expect, it } from "vitest";

import { emptyProfile } from "./calculate";
import { sanitizeProfile } from "./sanitize";
import { parseProfile } from "./schema";

function legacyWithout(...keys: string[]) {
  const profile: Record<string, unknown> = { ...emptyProfile() };
  for (const key of ["id", ...keys]) delete profile[key];
  return profile;
}

describe("parseProfile", () => {
  it("rejects non-objects and unsupported versions", () => {
    expect(() => parseProfile(null)).toThrow("version: 1");
    expect(() => parseProfile([])).toThrow("version: 1");
    expect(() => parseProfile({ ...emptyProfile(), version: 2 })).toThrow("version: 1");
  });

  it("fills a missing id and omitted sections (legacy saves)", () => {
    const parsed = parseProfile(legacyWithout("specialDeductions", "insurance"));
    expect(parsed.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(parsed.specialDeductions).toEqual([]);
    expect(parsed.insurance.lifeInsurance).toBe(0);
  });

  it("merges partial nested sections with defaults", () => {
    const p = emptyProfile();
    const parsed = parseProfile({ ...p, investment: { rmf: 1000 } });
    expect(parsed.investment.rmf).toBe(1000);
    expect(parsed.investment.thaiEsg).toBe(0);
  });

  it("rejects an explicit null section instead of zeroing it", () => {
    expect(() => parseProfile({ ...emptyProfile(), insurance: null })).toThrow("insurance");
  });

  it("rejects wrong types and unknown enums with the field path", () => {
    expect(() => parseProfile({ ...emptyProfile(), income401: "oops" })).toThrow("income401");
    const bad404 = {
      id: "x",
      label: "STOCKA",
      kind: "crypto",
      amount: 1,
      withheld: 0,
      taxCredit: 0,
      treatment: "auto",
    };
    expect(() => parseProfile({ ...emptyProfile(), income404: [bad404] })).toThrow(
      "income404.0.kind",
    );
  });

  it("accepts legacy numeric junk and normalizes it", () => {
    const p = emptyProfile();
    const parsed = parseProfile({
      ...p,
      personal: { ...p.personal, children: 1.5, ownParents: null, spouseParents: 5000 },
      insurance: { ...p.insurance, lifeInsurance: 2e12, healthInsurance: -5 },
    });
    expect(parsed.personal.children).toBe(1);
    expect(parsed.personal.ownParents).toBe(0);
    expect(parsed.personal.spouseParents).toBe(1000);
    expect(parsed.insurance.lifeInsurance).toBe(1e12);
    expect(parsed.insurance.healthInsurance).toBe(0);
  });

  it("re-ids duplicate rows so 40(4) treatments can't collide", () => {
    const row = {
      id: "dup",
      label: "STOCKA",
      kind: "thai_dividend",
      amount: 1000,
      withheld: 100,
      taxCredit: 0,
      treatment: "auto",
    };
    const parsed = parseProfile({
      ...emptyProfile(),
      income404: [row, { ...row, label: "STOCKB", treatment: "include" }],
    });
    const [a, b] = parsed.income404;
    expect(a.id).toBe("dup");
    expect(b.id).not.toBe("dup");
    expect(b.label).toBe("STOCKB");
  });

  it("strips unknown fields", () => {
    const parsed = parseProfile({ ...emptyProfile(), injected: "<script>" });
    expect("injected" in parsed).toBe(false);
  });

  it("relabels the tax year to the supported year", () => {
    expect(parseProfile({ ...emptyProfile(), taxYear: 2568 }).taxYear).toBe(2569);
  });
});

describe("save → load round trip", () => {
  it("anything sanitized for saving loads back", () => {
    const p = emptyProfile();
    const saved = sanitizeProfile({
      ...p,
      personal: { ...p.personal, children: 2.7 },
      investment: { ...p.investment, rmf: 1e308 },
      income401: [{ id: "a", label: "Company A", amount: Infinity, withheld: 100.005 }],
    });
    const loaded = parseProfile(JSON.parse(JSON.stringify(saved)));
    expect(loaded.personal.children).toBe(2);
    expect(loaded.investment.rmf).toBe(1e12);
    expect(loaded.income401[0].amount).toBe(0);
    expect(loaded.income401[0].withheld).toBe(100.01);
  });
});
