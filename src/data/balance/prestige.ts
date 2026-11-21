/**
 * Prestige (Story 5.1, FR28; GDD "Prestige"): the unlock condition. Read by
 * `systems/PrestigeSystem.ts`, whose requirement table turns each entry into
 * one requirement, so `isPrestigeAvailable` and `getUnmetRequirements` can
 * never disagree.
 *
 * - `buildingLevels`: the level each building must reach in the current run.
 * - `lifetimeProduced`: how much of each resource must have been produced
 *   across every run (`state.prestige.total…Produced`, kept by prestige).
 *
 * The award (Story 5.2, FR29): `floor(log10(totalFoodProduced) × phaseScore /
 * lp.phaseScoreDivisor)`, none below `lp.minFood` lifetime food, plus the
 * entropy bonus: at full entropy, `floor(entropy × lp.entropyLpPerPoint)`.
 * Each LP ever earned adds production (`progressionBalance.productionPerLegacyPoint`).
 *
 * - `royalCache`: what the Starting Resources Legacy node puts in a new run
 *   (eggs go into the egg pipeline, so they hatch).
 */
export const prestigeBalance = {
  unlock: {
    buildingLevels: { barracks: 5, walls: 5, warehouse: 5 },
    lifetimeProduced: { food: 100_000, wood: 50_000, stone: 50_000, nectar: 25_000 },
  },
  lp: {
    minFood: 10,
    phaseScoreDivisor: 10,
    entropyLpPerPoint: 2,
  },
  royalCache: { eggs: 50, food: 25 },
} as const;
