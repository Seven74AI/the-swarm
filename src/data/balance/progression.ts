/**
 * Pacing curves (Story 3.2, FR40): the production multiplier, the building
 * soft cap and building cost growth (the worker scale penalty became crowding, Story 9.13). Read by
 * `engine/ProgressionCurve.ts`. Tests import these; they never restate them.
 */
export const progressionBalance = {
  /** Production grows ×this for each phase reached: `perPhase ^ phaseNumber`. */
  productionPerPhase: 1.12,
  /** Each Legacy point adds this share of production. */
  productionPerLegacyPoint: 0.15,
  /** Building soft cap: full effect through `fullLevels`, then `base / (1 + falloffPerLevel × (level − fullLevels))`. */
  softCap: { fullLevels: 5, falloffPerLevel: 0.08 },
  /** Building costs grow `floor(baseCost × costGrowth^level)`. */
  buildingCostGrowth: 2.5,
} as const;
