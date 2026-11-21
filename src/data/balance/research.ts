/**
 * Research balance (Story 3.2): each project's cost, researchers and length,
 * and the cancel refund. Read by `systems/ResearchSystem.ts`; names, unlocks
 * and panels stay there. Lengths were already ms (the old comments gave the
 * ticks at 50 ms: 600, 1 500, 3 000, 1 200). The 0.1 antimatter cost is not an
 * integer yet: Story 3.3 fixes it.
 */
export const researchBalance = {
  projects: {
    voidCrystalSynthesis: { cost: { stone: 500, nectar: 200 }, requiredResearchers: 50, durationMs: 30_000 },
    antimatterContainment: { cost: { voidCrystals: 5 }, requiredResearchers: 30, durationMs: 75_000 },
    darkMatterDetection: { cost: { antimatter: 0.1 }, requiredResearchers: 20, durationMs: 150_000 },
    dormantForaging: { cost: { food: 300 }, requiredResearchers: 0, durationMs: 60_000 },
  },
  /** Cancelling a running project refunds this share of each cost (floored). */
  cancelRefundShare: 0.5,
} as const;
