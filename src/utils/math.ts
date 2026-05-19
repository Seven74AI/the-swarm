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
