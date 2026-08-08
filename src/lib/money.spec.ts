import { describe, expect, it } from "vitest";

import {
  addMoney,
  mulRate,
  mulRateFloor,
  roundMoney,
  subMoney,
  toSatang,
} from "./money";

describe("money satang arithmetic", () => {
  it("adds without 1-satang drift", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(addMoney(12345.67, 89012.34, 0.01, 0.02)).toBe(101358.04);
  });

  it("subtracts exactly in satang", () => {
    expect(subMoney(1.23, 0.62)).toBe(0.61);
    expect(addMoney(0.62, 0.61)).toBe(1.23);
  });

  it("half-ups rate multiplication", () => {
    expect(mulRate(1.23, 0.5)).toBe(0.62);
    expect(mulRate(100_000.05, 0.1)).toBe(10_000.01);
  });

  it("floors rate multiplication to satang", () => {
    expect(mulRateFloor(1.23, 0.5)).toBe(0.61);
    expect(mulRateFloor(0.31, 0.5)).toBe(0.15); // 0.155 → 0.15
  });

  it("normalizes dusty floats", () => {
    const dusty = 100.01 + 200.02;
    expect(roundMoney(dusty)).toBe(300.03);
    expect(toSatang(dusty)).toBe(30003);
  });
});
