/**
 * Hold-to-repeat timing for `Button` (Story 1.11, FR45, UX-DR11).
 *
 * UI feel, not game balance: these never change what an action does, only how
 * often a held button asks for it.
 *
 * - A press shorter than `HOLD_DELAY_MS` is a tap: it fires once, on release.
 * - Held longer, the action fires at `HOLD_DELAY_MS`, then every
 *   `REPEAT_INTERVAL_MS` (about 8 per second, the GDD rate).
 * - Once the hold has lasted `ACCELERATE_AFTER_MS`, repeats come every
 *   `FAST_REPEAT_INTERVAL_MS` (EXPERIENCE.md: "speeding up after 1 s",
 *   `[ASSUMPTION: acceleration]`; ×MAX is the alternative for big amounts).
 */
export const HOLD_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 125;
export const ACCELERATE_AFTER_MS = 1000;
export const FAST_REPEAT_INTERVAL_MS = 62;

/** Delay before the next repeat, given how long the pointer has been held. */
export function repeatDelay(heldMs: number): number {
  return heldMs < ACCELERATE_AFTER_MS ? REPEAT_INTERVAL_MS : FAST_REPEAT_INTERVAL_MS;
}
