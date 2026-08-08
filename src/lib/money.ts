/**
 * Money helpers in integer satang to avoid IEEE 1-satang drift.
 * All public baht values are normalized to 2 decimal places.
 */

export function toSatang(baht: number): number {
  if (!Number.isFinite(baht)) return 0;
  // 1e-6 clears binary dust around .xx5 without flipping real halves
  return Math.round(baht * 100 + Math.sign(baht || 1) * 1e-6);
}

export function fromSatang(satang: number): number {
  return satang / 100;
}

/** Half-up to satang. */
export function roundMoney(baht: number): number {
  return fromSatang(toSatang(baht));
}

export function addMoney(...amounts: number[]): number {
  let total = 0;
  for (const amount of amounts) total += toSatang(amount);
  return fromSatang(total);
}

export function subMoney(left: number, right: number): number {
  return fromSatang(toSatang(left) - toSatang(right));
}

/** amount × rate, half-up to satang. */
export function mulRate(amount: number, rate: number): number {
  return fromSatang(Math.round(toSatang(amount) * rate));
}

/** amount × rate, floor to satang (e.g. 1.23 × 50% → 0.61; 0.155 → 0.15). */
export function mulRateFloor(amount: number, rate: number): number {
  // tiny epsilon avoids binary dust turning e.g. 15 into 14.999999
  return fromSatang(Math.floor(toSatang(amount) * rate + 1e-9));
}

export function sumMoneyField<T>(items: T[], field: keyof T): number {
  let total = 0;
  for (const item of items) {
    const value = Number(item[field]);
    total += toSatang(Math.max(0, Number.isFinite(value) ? value : 0));
  }
  return fromSatang(total);
}
