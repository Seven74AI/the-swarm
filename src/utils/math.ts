/**
 * Calculate upgrade cost using exponential scaling.
 * Formula: Math.floor(baseCost * multiplier^level)
 */
export function upgradeCost(
  baseCost: number,
  multiplier: number,
  level: number,
): number {
  return Math.floor(baseCost * Math.pow(multiplier, level));
}

/**
 * Calculate production after upgrades.
 * Formula: baseProduction * (1 + multiplier * upgrades)
 */
export function calculateProduction(
  baseProduction: number,
  multiplier: number,
  upgrades: number,
): number {
  return baseProduction * (1 + multiplier * upgrades);
}

/**
 * Clamp a value between min and max inclusive.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Credit (or spend) a fractional `delta` to a whole-number amount (Story 2.5,
 * AR20): the amount stays an integer ≥ 0 and the fraction carries in
 * `remainder` (in [0, 1)) to the next step, so many short steps credit what
 * one long step does. An amount driven below 0 stops at 0 with no carry.
 */
export function creditWhole(
  amount: number,
  remainder: number,
  delta: number,
): { amount: number; remainder: number } {
  const total = amount + remainder + delta;
  if (total <= 0) return { amount: 0, remainder: 0 };
  const whole = Math.floor(total);
  return { amount: whole, remainder: total - whole };
}

/** The whole number halfway between two whole numbers, rounded down (binary search). */
export function midpoint(lo: number, hi: number): number {
  return Math.floor((lo + hi) / 2);
}
