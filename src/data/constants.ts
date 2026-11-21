/**
 * Game constants that rarely change (arch: Configuration). `as const`.
 */

/** The tab bar never shows more than this many tabs (UX-DR5, EXPERIENCE.md: a phase adds tabs or segments, never a sixth tab). */
export const MAX_TABS = 5 as const;
