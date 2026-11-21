/**
 * Pacing curves (Story 3.2, FR40): the production multiplier, the building
 * soft cap, the worker scale penalty and building cost growth. Read by
 * `engine/ProgressionCurve.ts`. Tests import these; they never restate them.
 */
export const progressionBalance = {
  /** Production grows ×this for each phase reached: `perPhase ^ phaseNumber`. */
  productionPerPhase: 1.12,
  /** Each Legacy point adds this share of production. */
  productionPerLegacyPoint: 0.15,
  /** Building soft cap: full effect through `fullLevels`, then `base / (1 + falloffPerLevel × (level − fullLevels))`. */
  softCap: { fullLevels: 5, falloffPerLevel: 0.08 },
  /** Worker scale penalty: full efficiency through `freeWorkers`, then `1 / (1 + falloffPerWorker × (workers − freeWorkers))`. */
  scalePenalty: { freeWorkers: 500, falloffPerWorker: 0.0005 },
  /** Building costs grow `floor(baseCost × costGrowth^level)`. */
  buildingCostGrowth: 2.5,
} as const;
