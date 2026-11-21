/**
 * Mutation balance (Story 3.2): costs in combat resources and effect sizes.
 * Read by `systems/MutationSystem.ts`; names, descriptions and prerequisites
 * stay there. `…Share` effects are shares of the base rate (0.1 = +10 %),
 * mapped to the system's `gatherRate`/`hatchRate` bonuses.
 */
export const mutationBalance = {
  efficient_gatherers: { cost: { silk: 5, chitin: 5, venom: 0 }, effects: { gatherShare: 0.1 } },
  swift_soldiers: { cost: { chitin: 10, silk: 0, venom: 5 }, effects: { speed: 1 } },
  accelerated_hatching: { cost: { silk: 10, chitin: 0, venom: 5 }, effects: { hatchShare: 0.2 } },
  tough_shells: { cost: { chitin: 15, silk: 10, venom: 0 }, effects: { maxHp: 2 } },
  potent_venom: { cost: { venom: 20, chitin: 10, silk: 0 }, effects: { poisonDamage: 0.5 } },
  reinforced_mandibles: { cost: { chitin: 20, silk: 15, venom: 0 }, effects: { strength: 1 } },
} as const;
