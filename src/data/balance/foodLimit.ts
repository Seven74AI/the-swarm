/**
 * The food limit (Story 9.15, FR62): a base for the starting chambers plus a
 * share for every room dug; each Larder room adds its `foodLimit`
 * (`data/balance/roomJobs.ts`). Read by `systems/FoodLimit.ts`. The base
 * covers every Phase 1 price, and the rooms a phase's guard needs cover its
 * prices (the no-catch-22 property test). Tests import these; they never restate them.
 */
export const foodLimitBalance = {
  /** Food the starting chambers hold. */
  base: 2_000,
  /** Food every room dug adds to the store. */
  perRoom: 1_000,
} as const;
