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
