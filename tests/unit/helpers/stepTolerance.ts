import type { GameState } from '../../../src/state/GameState';
import { getAutoLayRate } from '../../../src/engine/AutoProductionLoop';
import { TICK_MS } from '../../../src/data/constants';

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

/**
 * The largest rate constant (per second) of each pipeline stage in `s`, from its
 * rate at count 1, and the eggs laid a second (`inflow`). Measured, not
 * hard-coded: one item in a stage, one `step` of a tick, no carried progress.
 */
export function stageRates(
  s: GameState,
  step: (state: GameState, dtSec: number) => GameState,
): { hatch: number; mature: number; train: number; inflow: number } {
  const TICK_SEC = TICK_MS / 1000;
  const probe = (patch: (x: GameState) => void) => {
    const x = structuredClone(s);
    x.eggPipeline = { count: 0, progress: 0 };
    x.larvaPipeline = { count: 0, progress: 0 };
    x.soldierPipeline = { count: 0, progress: 0 };
    x.autoProduction = { ...x.autoProduction, enabled: false };
    x.prestigeTree = { purchased: x.prestigeTree.purchased.filter((id) => id !== 'auto_egg_laying') };
    patch(x);
    return x;
  };
  const after = (x: GameState) => step(x, TICK_SEC);
  const hatch = after(probe((x) => { x.resources.eggs = 1_000_000; x.eggPipeline.count = 1_000_000; })).resources.larvae / 1_000_000 / TICK_SEC;
  const mature = after(probe((x) => { x.resources.larvae = 1_000_000; x.larvaPipeline.count = 1_000_000; x.resources.nestCapacity = 10_000_000; })).resources.workers;
  const matureRate = (mature - s.resources.workers) / 1_000_000 / TICK_SEC;
  const train = after(probe((x) => { x.soldierPipeline.count = 1_000_000; })).combatSoldiers;
  const trainRate = (train - s.combatSoldiers) / 1_000_000 / TICK_SEC;
  return { hatch, mature: matureRate, train: trainRate, inflow: getAutoLayRate(s) };
}
