import type { GameState } from '../state/GameState';
import { OFFLINE_WORKER_FLOOR_SHARE } from '../data/constants';

/**
 * Offline-only rules (Story 2.7, FR24, AR4/D2). Catch-up runs the same
 * `processTick` as foreground play; what differs offline lives here and in
 * `catchUp`, never at a call site:
 *
 * - No decision events: `processTick` has no decision system (`tickDecisions`
 *   runs only in main's live step, on the session clock), so none spawns and an
 *   open one neither counts down nor times out.
 * - No phase commit: catch-up only latches the goal (`CatchUpDeps.latch`).
 * - Events go to a collecting queue that is never flushed: nothing plays or animates.
 * - Automation runs as the player set it (it is part of `processTick`).
 * - The starvation floor (below): workers never end a step under
 *   `floor(OFFLINE_WORKER_FLOOR_SHARE × workers before the absence)`.
 *   Foreground play has no floor.
 */
export interface OfflineRules {
  /** The fewest workers the absence may leave. */
  readonly workerFloor: number;
}

/**
 * The starvation floor of an absence (FR24): the fewest workers a catch-up
 * may leave, `floor(OFFLINE_WORKER_FLOOR_SHARE × workers before the absence)`.
 */
export function offlineWorkerFloor(before: GameState): number {
  return Math.floor(OFFLINE_WORKER_FLOOR_SHARE * Math.max(0, before.resources.workers));
}

/** The rules for one absence, fixed from the state before it. */
export function offlineRulesFor(before: GameState): OfflineRules {
  return { workerFloor: offlineWorkerFloor(before) };
}

/**
 * Applied after every catch-up step: starvation (or anything else) cannot take
 * the workforce under the floor. It only ever restores lost workers, never
 * adds past the pre-absence count, and returns `state` itself when nothing changes.
 */
export function applyOfflineRules(state: GameState, rules: OfflineRules): GameState {
  if (state.resources.workers >= rules.workerFloor) return state;
  return { ...state, resources: { ...state.resources, workers: rules.workerFloor } };
}
