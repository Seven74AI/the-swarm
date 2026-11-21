/**
 * The step-length tolerance (Story 2.5, AR4): how far one step of `T` seconds
 * may differ from many short steps over the same `T`. Shared by the step-length
 * property tests and the catch-up equivalence test (Story 2.6). The reasoning
 * is in `tests/unit/engine/stepLength.test.ts`.
 */

/** A whole-number amount credited with a carried fraction differs by under one unit per stage. */
export const WHOLE_UNIT_CARRY = 1;

/**
 * Items a pipeline stage (or a chain of `stages`) may differ by over `windowSec`:
 * one carried item per stage, `k × T` per stage for whole-item counts versus the
 * continuous solution (`k` = the stage's rate constant per second), and, for eggs
 * laid in the window at `inflow` a second, one more carried item plus the
 * `inflow × T × k × T` the short steps start hatching early.
 */
export function pipelineTolerance(k: number, stages: number, windowSec: number, inflow = 0): number {
  const carried = (stages + (inflow > 0 ? 1 : 0)) * WHOLE_UNIT_CARRY;
  return carried + stages * k * windowSec + inflow * windowSec * k * windowSec;
}

/**
 * Amount an accumulated value may differ by over `windowSec` when its rate,
 * sampled along the short-step run in `rates`, changes inside the window: the
 * left-Riemann bound `(max − min) × T`, plus one whole unit for flooring.
 */
export function rateTolerance(rates: number[], windowSec: number): number {
  return (Math.max(...rates) - Math.min(...rates)) * windowSec + WHOLE_UNIT_CARRY;
}
