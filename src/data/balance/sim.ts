import { HOUR_MS } from '../constants';

const MIN_MS = 60_000;

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
  /**
   * The first week (Story 9.1, FR54; GDD *Session Shape*), `firstWeekSchedule`'s
   * shape: session 1 is one continuous session, then `checkInsPerDay` check-ins a
   * day spread over the waking day (session 1 is day 1's first). Through
   * `earlyDays` each lasts `earlySessionMs`; to the end of `weekDays` they shrink
   * linearly toward `steadySessionMs`; after it each is played until the player
   * has no useful move left, at most `checkInCeilingMs` (its length is measured).
   */
  firstWeek: {
    session1Ms: 50 * MIN_MS,
    earlyDays: 3,
    earlySessionMs: 10 * MIN_MS,
    weekDays: 7,
    steadySessionMs: 2 * MIN_MS,
    checkInCeilingMs: 5 * MIN_MS,
  },
} as const;
