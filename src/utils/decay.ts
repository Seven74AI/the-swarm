/**
 * Closed-form pipeline flow for one step of any length (Story 2.5, AR4).
 *
 * A rate-based pipeline (`count / time` items per second) is first-order
 * decay: over `dtSec` a share `1 − e^(−k·dt)` of its items completes. Using the
 * exact share instead of `k·dt` makes one long step move what many short ones
 * do (and never more items than the pipeline holds), whatever the step length.
 */

/** Share of a pipeline's items that complete in `dtSec` at rate constant `k` (per second). */
export function completedShare(k: number, dtSec: number): number {
  if (k <= 0 || dtSec <= 0) return 0;
  return -Math.expm1(-k * dtSec);
}

/** `(1 − e^(−x)) / x`, 1 at 0: stable for small `x`. */
function phi(x: number): number {
  return x < 1e-9 ? 1 - x / 2 : -Math.expm1(-x) / x;
}

/**
 * Share of a first stage's items (rate `a`) that also complete a second stage
 * (rate `b`) within the same `dtSec`: an egg that hatches and matures in one
 * step. Symmetric in `a` and `b`; stable when they are equal.
 */
export function chainedShare(a: number, b: number, dtSec: number): number {
  if (a <= 0 || b <= 0 || dtSec <= 0) return 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  // Items still in stage two: a·(e^(−aT) − e^(−bT)) / (b − a).
  const inStageTwo = a * Math.exp(-lo * dtSec) * dtSec * phi((hi - lo) * dtSec);
  return Math.max(0, completedShare(a, dtSec) - inStageTwo);
}
