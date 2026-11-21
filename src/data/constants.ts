/**
 * Game constants that rarely change (arch: Configuration). `as const`.
 */

/** Milliseconds in a second: converts balance durations (`…Ms`) to the systems' `dtSec` and back. */
export const MS_PER_SEC = 1000 as const;

/** A whole, in percentage points: `share = points / PERCENT`. */
export const PERCENT = 100 as const;

/** The tab bar never shows more than this many tabs (UX-DR5, EXPERIENCE.md: a phase adds tabs or segments, never a sixth tab). */
export const MAX_TABS = 5 as const;

/**
 * Resume (Story 2.3, D1): a gap shorter than this runs at full efficiency with no
 * summary; this long or longer is offline time at the offline efficiency.
 */
export const RESUME_FULL_EFFICIENCY_MS = 60_000 as const;

/** A visible frame gap longer than this (a stall, a throttled tab) goes to `resume(gap)` (D1). */
export const FRAME_GAP_MS = 1_000 as const;

/** One hour in ms. Hour-sized ms values are spelled only in this file (tests/arch/offlineCap.test.ts). */
export const HOUR_MS = 60 * 60 * 1000;

/** One day in ms (the simulated player's check-in schedule, Story 3.7). */
export const DAY_MS = 24 * HOUR_MS;

/**
 * The offline cap (Story 2.4, FR20): resumed time past `getOfflineCapMs(state)`
 * is not simulated. The baseline is 12 h; owned Legacy upgrades raise it
 * (`PrestigeUpgrade.offlineCapRaiseMs`, Story 2.8), never above the ceiling.
 */
export const OFFLINE_CAP_BASE_MS = 12 * HOUR_MS;
/** The highest the offline cap can be raised (Story 2.8: "the cap never above 24 h"). */
export const OFFLINE_CAP_MAX_MS = 24 * HOUR_MS;
/** What each Legacy cap-raise node adds (Story 2.8): two of them take 12 h to 24 h. */
export const OFFLINE_CAP_RAISE_MS = 6 * HOUR_MS;

/**
 * Offline efficiency (Story 2.8, FR21), in percentage points: a new run is at
 * the base; the run's offline research and the Legacy efficiency node each add
 * their `offlineEfficiencyPoints`, in either order; the sum never exceeds the
 * max. `getOfflineEfficiency(state)` is the only place this is computed.
 */
export const OFFLINE_EFFICIENCY_BASE_POINTS = 50 as const;
export const OFFLINE_EFFICIENCY_MAX_POINTS = 100 as const;
/** What the run research and the Legacy efficiency node each add (Story 2.8): 50 + 25 + 25 = 100. */
export const OFFLINE_EFFICIENCY_STEP_POINTS = 25 as const;

/**
 * The fixed simulation step (Ticker, 20 Hz). Systems are correct for any step
 * length (Story 2.5, AR4). No balance value is written in ticks (Story 3.2):
 * durations are `…Ms` and rates `…PerSec` in `data/balance/`.
 */
export const TICK_MS = 50 as const;

/**
 * Offline catch-up (Story 2.6, D2/AR4): the macro-step. Catch-up advances
 * through the same `processTick` the game uses, in steps of this length
 * (initial value 10 s; tuned with `pnpm perf`). Systems are correct for any
 * step length (Story 2.5).
 */
export const CATCH_UP_STEP_MS = 10_000 as const;

/**
 * The CI step budget (Story 2.6, NFR4): a 24 h catch-up (`OFFLINE_CAP_MAX_MS`)
 * calls `processTick` at most this many times. A fixed number, so a smaller
 * `CATCH_UP_STEP_MS` fails tests/unit/engine/catchUpBudget.test.ts until the
 * budget is raised on purpose (and `pnpm perf` re-checked on the reference phone).
 */
export const CATCH_UP_MAX_STEPS = 8_640 as const;

/**
 * The offline starvation floor (Story 2.7, FR24): inside a catch-up, workers
 * never fall below `floor(this × workers before the absence)`. Foreground
 * play has no floor. Applied by `src/engine/offlineRules.ts` only.
 */
export const OFFLINE_WORKER_FLOOR_SHARE = 0.5 as const;

/**
 * NFR4: a 12 h (24 h with upgrades) catch-up finishes within this on the
 * reference phone. Reported by `pnpm perf` (tests/perf/), never asserted in CI.
 */
export const CATCH_UP_BUDGET_MS = 500 as const;

/**
 * Play telemetry (Story 3.10, FR38): the ring buffer's fixed size, in entries
 * (check-ins and phase records). The oldest drop first; a full buffer is a few
 * tens of kB in storage.
 */
export const TELEMETRY_MAX_ENTRIES = 500 as const;
