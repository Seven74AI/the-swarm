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
 * - The starvation cap (Story 9.16): starvation may take at most 20% of the
 *   eaters before the absence (`offlineDeathCap`, passed by `catchUp`). The
 *   worker floor below restores workers lost some other way. Foreground play
 *   has neither.
 */
export interface OfflineRules {
  /** The fewest workers the absence may leave. */
  readonly workerFloor: number;
  /** Workers already in soldiers, scouts and warriors before the absence (see `convertedWorkers`). */
  readonly convertedBefore: number;
  /** The run's starved workers before the absence (Story 9.16). */
  readonly starvedBefore: number;
  /** Workers before the absence. */
  readonly workersBefore: number;
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
 * How many eaters an absence may starve (Story 9.16): the eaters before it
 * minus `ceil(OFFLINE_WORKER_FLOOR_SHARE × eaters)`, in whole ants (so 20% of
 * 10 is 2, never 1 by a floating-point slip). Catch-up caps starvation's deaths at this.
 */
export function offlineDeathCap(before: GameState): number {
  const eaters = Math.max(0, eatersOf(before));
  return eaters - Math.ceil(OFFLINE_WORKER_FLOOR_SHARE * eaters);
}

/**
 * The worker floor of an absence (FR24): `ceil(OFFLINE_WORKER_FLOOR_SHARE ×
 * workers before the absence)`. It restores workers lost some other way than
 * starvation, whose own deaths are capped (`offlineDeathCap`) and never handed back.
 */
export function offlineWorkerFloor(before: GameState): number {
  return Math.ceil(OFFLINE_WORKER_FLOOR_SHARE * Math.max(0, before.resources.workers));
}

/** The rules for one absence, fixed from the state before it. */
export function offlineRulesFor(before: GameState): OfflineRules {
  return { workerFloor: offlineWorkerFloor(before), workersBefore: before.resources.workers, convertedBefore: convertedWorkers(before), starvedBefore: before.starvation.starvedWorkers };
}

/**
 * Applied after every catch-up step: starvation (or anything else) cannot take
 * the workforce under the floor. It only ever restores lost workers, never
 * adds past the pre-absence count, and returns `state` itself when nothing changes.
 */
export function applyOfflineRules(state: GameState, rules: OfflineRules): GameState {
  // Workers the colony turned into soldiers, scouts and warriors are not handed back. Starvation may
  // take a fifth of the eaters (soldiers included), so when soldiers weigh the cap it can take more
  // than a fifth of the workers: those extra starved workers are not handed back either.
  const starved = Math.max(0, state.starvation.starvedWorkers - rules.starvedBefore);
  const beyondOwnShare = Math.max(0, starved - (rules.workersBefore - rules.workerFloor));
  const floor = rules.workerFloor - Math.max(0, convertedWorkers(state) - rules.convertedBefore) - beyondOwnShare;
  if (state.resources.workers >= floor) return state;
  return { ...state, resources: { ...state.resources, workers: floor } };
}
