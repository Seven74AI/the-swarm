/**
 * Mutation balance (Story 3.2): costs in combat resources and effect sizes.
 * Read by `systems/MutationSystem.ts`; names, descriptions and prerequisites
 * stay there. `…Share` effects are shares of the base rate (0.1 = +10 %),
 * mapped to the system's `gatherRate`/`hatchRate` bonuses. What a mutation
 * does in battle, and the traits it counters, is in `combat.ts` (Story 4.2).
 */
export const mutationBalance = {
  efficient_gatherers: { cost: { silk: 5, chitin: 5, venom: 0 }, effects: { gatherShare: 0.1 } },
  swift_soldiers: { cost: { chitin: 10, silk: 0, venom: 5 }, effects: {} },
  accelerated_hatching: { cost: { silk: 10, chitin: 0, venom: 5 }, effects: { hatchShare: 0.2 } },
  tough_shells: { cost: { chitin: 20, silk: 0, venom: 0 }, effects: {} },
  potent_venom: { cost: { venom: 20, chitin: 10, silk: 0 }, effects: {} },
  reinforced_mandibles: { cost: { chitin: 20, silk: 15, venom: 0 }, effects: {} },
} as const;
