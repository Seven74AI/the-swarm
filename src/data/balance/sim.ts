import { HOUR_MS } from '../constants';

/**
 * The simulated player (Story 3.7, AR15, D12): how often it checks in, how
 * long it plays and how fast it taps. These describe a player, not the game,
 * and feed only `src/sim/`; the pacing pass (Story 3.9) tunes them. Tests
 * import these; they never restate the numbers.
 */
export const simBalance = {
  /** Check-ins a day (the GDD's "about 6 times a day"). */
  checkInsPerDay: 6,
  /** The waking day the check-ins are spread over; the rest is the overnight gap. */
  wakingMs: 16 * HOUR_MS,
  /** How long each check-in is played. */
  checkInActiveMs: 300_000,
  /** While playing, the player looks and acts this often; the time between goes through resume. */
  activeStepMs: 5_000,
  /** Sustained LAY EGG taps a second while playing (hold-to-repeat counts as taps). */
  tapsPerSec: 4,
  /** At most this many moves (taps excluded) in one look, so a policy can never spin. */
  maxMovesPerTurn: 25,
} as const;
