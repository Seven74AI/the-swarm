/**
 * The food line's net (DESIGN.md → Upkeep readout): WRKR's `NET ±n/S`, and the
 * strip's food delta while the store is held at 0 (#494), so the two never
 * disagree.
 */

/**
 * One precision for the whole food line: a decimal while the rates are small,
 * whole numbers once they reach 100.
 */
export function foodLineDecimals(production: number, upkeep: number): number {
  return Math.max(Math.abs(production), Math.abs(upkeep)) < 100 ? 1 : 0;
}

/**
 * The net WRKR shows, scaled by its precision (`10 ** foodLineDecimals`): the
 * rounded production minus the rounded upkeep, so the line always adds up.
 */
export function foodLineScaledNet(production: number, upkeep: number): number {
  const scale = 10 ** foodLineDecimals(production, upkeep);
  return Math.round(production * scale) - Math.round(upkeep * scale);
}

/** The net WRKR shows, per second (a decimal while the rates are small). */
export function foodLineNet(production: number, upkeep: number): number {
  return foodLineScaledNet(production, upkeep) / 10 ** foodLineDecimals(production, upkeep);
}
