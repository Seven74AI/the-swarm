/**
 * Game constants that rarely change (arch: Configuration). `as const`.
 */

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

/**
 * The offline cap (Story 2.4, FR20): resumed time past `getOfflineCapMs(state)`
 * is not simulated. The baseline is 12 h; owned Legacy upgrades raise it
 * (`PrestigeUpgrade.offlineCapRaiseMs`, Story 2.8), never above the ceiling.
 */
export const OFFLINE_CAP_BASE_MS = 12 * HOUR_MS;
/** The highest the offline cap can be raised (Story 2.8: "the cap never above 24 h"). */
export const OFFLINE_CAP_MAX_MS = 24 * HOUR_MS;

/**
 * The fixed simulation step (Ticker, 20 Hz). Systems are correct for any step
 * length (Story 2.5, AR4); until Story 3.2 moves balance to milliseconds, the
 * values still written in ticks are converted with this.
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
 * NFR4: a 12 h (24 h with upgrades) catch-up finishes within this on the
 * reference phone. Reported by `pnpm perf` (tests/perf/), never asserted in CI.
 */
export const CATCH_UP_BUDGET_MS = 500 as const;
