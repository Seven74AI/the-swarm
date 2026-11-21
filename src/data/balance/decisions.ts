/**
 * Decision-event timing (Story 1.28, D8). Tests import these; they never
 * restate the numbers.
 */
export const decisionBalance = {
  /** No event spawns before this much foreground play in a session, and none sooner after the last one closed. */
  spawnMinMs: 120_000,
  /** The spawn time is drawn between min and max (exclusive). */
  spawnMaxMs: 180_000,
  /** The `double` decision-timer setting slows the countdown by this factor. */
  doubleTimerFactor: 2,
} as const;
