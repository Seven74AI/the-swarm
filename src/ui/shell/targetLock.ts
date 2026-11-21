/** Whether the player is on the primary action: holding it now, or when they last touched it. */
export interface TargetLock {
  readonly holding: boolean;
  /** UI clock (ms) of the last press or release, or null when untouched. */
  readonly lastTouchMs: number | null;
}

/**
 * The target the primary action shows (Story 1.21, UX-DR12): the latest
 * suggestion, except that it never changes under the thumb. While held, and
 * for `lockMs` after the last touch, the shown target stays. A fresh label for
 * the same target (same `key`, e.g. the next level) is taken at once.
 */
export function lockedTarget<T extends { readonly key: string }>(
  shown: T | null,
  latest: T,
  lock: TargetLock,
  nowMs: number,
  lockMs: number,
): T {
  if (shown === null || shown.key === latest.key) return latest;
  if (lock.holding) return shown;
  if (lock.lastTouchMs !== null && nowMs - lock.lastTouchMs < lockMs) return shown;
  return latest;
}
