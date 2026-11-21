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
