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
  /**
   * Automation targets (Story 4.10, FR16): a verb is automatable after this
   * many manual performances (or from the phase after its own), the row
   * starts at `defaultTarget` with AUTO off, and a target goes no higher
   * than `maxTarget`. Automatic laying is the queen laying on her own at
   * `layTapsPerSec` taps a second (each worth one tap's eggs, so Click Power
   * still counts), far slower than a player's taps: it keeps a brood topped
   * up, it doesn't replace Phase 1's tapping.
   */
  /**
   * Auto-dig (Story 9.5, FR58, FR16's manual-count rule): the BUILD card opens
   * once `unlockAfterRoomsByHand` rooms have been opened by a DIG press, costs
   * `costStone` (stone comes from digging, so it is always producible first),
   * and then the diggers press DIG on their own `pressesPerSec` times a
   * second, each press worth the usual chunk. Priced so the first-week sim
   * buys it around the end of day 1; Story 9.9 may retune it.
   */
  autoDig: {
    unlockAfterRoomsByHand: 3,
    costStone: 20_000,
    pressesPerSec: 1,
  },
  targets: {
    unlockAfterManual: 10,
    defaultTarget: 10,
    maxTarget: 999,
    layTapsPerSec: 0.25,
  },
} as const;
