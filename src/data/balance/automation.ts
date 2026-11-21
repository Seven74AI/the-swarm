/**
 * Automation balance (Story 3.2): research costs and auto-lay rates, and the
 * automation buildings. Read by `systems/AutomationSystem.ts`; names and
 * prerequisites stay there.
 */
export const automationBalance = {
  research: {
    basic_incubation: { cost: { food: 100, workers: 50 }, eggsPerSec: 0.5 },
    queens_pheromones: { cost: { food: 500, workers: 200 }, eggsPerSec: 2, hatchBonusPercent: 10 },
    thermal_regulation: { cost: { stone: 200, food: 1000 }, eggsPerSec: 5 },
    genetic_optimization: { cost: { voidCrystals: 5, workers: 50 }, multiplier: 1.5 },
    cloning_vats: { cost: { antimatter: 2, workers: 100 }, multiplier: 2 },
  },
  buildings: {
    nursery: { maxLevel: 10, baseCost: { wood: 20, food: 50 } },
    hatchery: { maxLevel: 5, baseCost: { stone: 100, voidCrystals: 2 } },
    queens_chamber: { maxLevel: 1, baseCost: { nectar: 50, stone: 200 } },
  },
  /** Nursery: flat auto-laid eggs per level. */
  nurseryEggsPerSecPerLevel: 1,
  /** Hatchery: multiplier share per level (×1.2 at Lv.1). */
  hatcheryMultiplierPerLevel: 0.2,
  /** Queen's Chamber: efficiency share per level. */
  queensChamberEfficiencyPerLevel: 0.1,
} as const;
