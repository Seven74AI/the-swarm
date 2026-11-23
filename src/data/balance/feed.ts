/**
 * FEED (Story 9.4, FR57): tapping the brood from Colony on hurries larvae
 * into a free room. Free (owner, 2026-11-23). Read by `systems/Brood.ts`.
 * Tests import these; they never restate the numbers.
 */
export const feedBalance = {
  /** Larvae one FEED tap matures at once, at most (and never more than the free rooms). */
  larvaePerFeed: 1,
} as const;
