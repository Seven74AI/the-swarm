import type { GameState } from '../state/GameState';
import { OFFLINE_WORKER_FLOOR_SHARE } from '../data/constants';
import { combatBalance } from '../data/balance/combat';
import { automationCount } from '../systems/AutomationTargets';

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
 * - Automation runs as the player set it (it is part of `processTick`):
 *   the targets of Story 4.10 included.
 * - The starvation floor (below; Story 9.16 made it cover soldiers): the
 *   eaters (workers and soldiers) never end a step under
 *   `ceil(OFFLINE_WORKER_FLOOR_SHARE × eaters before the absence)`.
 *   Starvation stops there (`catchUp` passes the same floor); this rule only
 *   restores workers lost some other way. Foreground play has no floor.
 */
export interface OfflineRules {
  /** The fewest workers the absence may leave. */
  readonly workerFloor: number;
  /** Workers already in soldiers, scouts and warriors before the absence (see `convertedWorkers`). */
  readonly convertedBefore: number;
}

/**
 * Workers the colony itself turned into soldiers, scouts and warriors
 * (Story 4.10's automation does this offline). They left the workforce by
 * the player's own target, not by starvation, so the floor never hands them
 * back: it would make workers from nothing.
 */
function convertedWorkers(s: GameState): number {
  return automationCount(s, 'train') * combatBalance.army.workersPerSoldier + automationCount(s, 'scout') + automationCount(s, 'warrior');
}

/** Eaters: workers, and soldiers trained or in training (Story 9.16). */
const eatersOf = (s: GameState): number => s.resources.workers + s.combatSoldiers + s.soldierPipeline.count;

/**
 * The starvation floor of an absence (FR24, Story 9.16): the fewest eaters a
 * catch-up may leave, `ceil(OFFLINE_WORKER_FLOOR_SHARE × eaters before the absence)`.
 */
export function offlineWorkerFloor(before: GameState): number {
  return Math.ceil(OFFLINE_WORKER_FLOOR_SHARE * Math.max(0, eatersOf(before)));
}

/** The rules for one absence, fixed from the state before it. */
export function offlineRulesFor(before: GameState): OfflineRules {
  return { workerFloor: offlineWorkerFloor(before), convertedBefore: convertedWorkers(before) };
}

/**
 * Applied after every catch-up step: starvation (or anything else) cannot take
 * the workforce under the floor. It only ever restores lost workers, never
 * adds past the pre-absence count, and returns `state` itself when nothing changes.
 */
export function applyOfflineRules(state: GameState, rules: OfflineRules): GameState {
  // Soldiers the colony trained from its workers are eaters still; scouts and warriors are not.
  const floor = rules.workerFloor - Math.max(0, convertedWorkers(state) - rules.convertedBefore);
  const short = floor - eatersOf(state);
  if (short <= 0) return state;
  return { ...state, resources: { ...state.resources, workers: state.resources.workers + short } };
}
