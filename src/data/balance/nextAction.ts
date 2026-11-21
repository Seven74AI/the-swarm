/**
 * Tuning of the next-action rule (Story 1.21, UX-DR12, EXPERIENCE.md
 * "Next-action rule"; the values are the UX's [ASSUMPTION]s, owned by the
 * pacing pass). Tests import these; they never restate the numbers.
 */
export const nextActionBalance = {
  /** Food is critical when the net rate is negative and the stock covers less than this many seconds of upkeep. */
  foodCriticalSeconds: 60,
  /** Capacity is critical when workers fill at least this percentage of the effective nest capacity. */
  capacityCriticalPercent: 95,
  /** The primary action keeps its target while held and for this long after the last tap. */
  targetLockMs: 1000,
  /** A job the food and capacity fixes never take below this many workers (the Colony goal needs a guard). */
  minGuards: 1,
} as const;
