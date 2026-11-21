/**
 * Narrative-beat timing (Story 4.9, FR19). Tests import these; they never
 * restate the numbers.
 */
export const narrativeBalance = {
  /**
   * The near-goal beat (`data/content/narrative.ts`) is written once per run, the first time the
   * phase goal's progress (the goal meter's percentage, `goalPercent`) reaches this.
   */
  nearGoalPercent: 80,
} as const;
