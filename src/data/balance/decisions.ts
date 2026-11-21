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
  /**
   * No outcome wipes the colony (Story 4.5, FR14): one choice or ignore can
   * take workers down to this share of the workers on hand (rounded up, so
   * never the last one), no further.
   */
  workerFloorShare: 0.5,
  /** OVERCROWDING. spawns only once the workers fill this share of the nest's capacity. */
  crowdedShare: 0.9,
} as const;
