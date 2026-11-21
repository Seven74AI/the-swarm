import type { GameState } from '../state/GameState';
import type { RoleId } from '../data/content/roles';
import { nextActionBalance } from '../data/balance/nextAction';
import { midpoint } from '../utils/math';
import { computeResourceRates, getAssignedWorkers } from './ResourceSystem';
import { TerritorySystem } from './TerritorySystem';
import { isCapacityCritical, isFoodCritical, workersOpen } from './NextAction';

/**
 * The workforce rules behind WRKR (Story 1.23, UX-DR15). Pure.
 *
 * `resources.workers` holds every worker but the researchers (a researcher
 * leaves the pool, see ResearchSystem). The workforce is both; the assigned
 * total is the job roles plus the researchers; what is left is free.
 */

/** Where a move takes workers from: a role, or the free pool. */
export type MoveSource = RoleId | 'free';

/** Every worker of the colony, researchers included. */
export function workforceTotal(s: GameState): number {
  return s.resources.workers + s.workersAssigned.researchers;
}

/** Workers on a role: the job roles plus the researchers. */
export function assignedTotal(s: GameState): number {
  return getAssignedWorkers(s) + s.workersAssigned.researchers;
}

/** Workers on no role (never negative). */
export function freeWorkers(s: GameState): number {
  return Math.max(0, s.resources.workers - getAssignedWorkers(s));
}

/** Workers on one role. */
export function roleCount(s: GameState, role: RoleId): number {
  return role === 'research' ? s.workersAssigned.researchers : s.workersAssigned[role];
}

const whole = (n: number): boolean => Number.isInteger(n) && n !== 0;

/**
 * Put `delta` free workers on a role (negative: take them off). One new
 * state, or the same state when the step can't be taken (not a whole
 * number, not enough free workers, not enough on the role).
 */
export function stepRole(s: GameState, role: RoleId, delta: number): GameState {
  if (!whole(delta)) return s;
  if (delta > 0 && freeWorkers(s) < delta) return s;
  if (delta < 0 && roleCount(s, role) < -delta) return s;
  if (role === 'research') {
    return {
      ...s,
      resources: { ...s.resources, workers: s.resources.workers - delta },
      workersAssigned: { ...s.workersAssigned, researchers: s.workersAssigned.researchers + delta },
    };
  }
  return { ...s, workersAssigned: { ...s.workersAssigned, [role]: s.workersAssigned[role] + delta } };
}

/** Move `count` workers from a role (or the free pool) to another role, in one state; the same state when it can't. */
export function moveWorkers(s: GameState, from: MoveSource, to: RoleId, count: number): GameState {
  if (!whole(count) || count < 0 || from === to) return s;
  if (from === 'free') return stepRole(s, to, count);
  if (roleCount(s, from) < count) return s;
  return stepRole(stepRole(s, from, -count), to, count);
}

/** A suggested reallocation: the WRKR primary action (`> MOVE 4 TO GATHER`). */
export interface Reallocation {
  /** Which next-action rule it answers (Story 1.21). */
  readonly rule: 'food' | 'capacity';
  readonly from: MoveSource;
  readonly to: RoleId;
  /** Whole workers, at least 1. */
  readonly count: number;
}

/** Food made minus food eaten per second (workers and the army), territory included. */
export function netFoodPerSec(s: GameState): number {
  const r = computeResourceRates(s, new TerritorySystem().getBonuses(s));
  return r.foodProducedPerSec - r.foodConsumedPerSec;
}
const netFood = netFoodPerSec;

/** How many of a source may be moved: all free workers, every worker on a job, guards above the minimum. */
function movable(s: GameState, from: MoveSource): number {
  if (from === 'free') return freeWorkers(s);
  if (from === 'guard') return Math.max(0, roleCount(s, from) - nextActionBalance.minGuards);
  return roleCount(s, from);
}

/** The first source with workers to move, in the order the next-action rule takes them. */
function firstSource(s: GameState, sources: readonly MoveSource[]): MoveSource | null {
  return sources.find((src) => movable(s, src) > 0) ?? null;
}

/** The fewest workers from `from` to GATHER that stop the food loss (all of them when none does). */
function fewestToStopLoss(s: GameState, from: MoveSource): number {
  const most = movable(s, from);
  if (netFood(moveWorkers(s, from, 'gather', most)) < 0) return most;
  let lo = 1;
  let hi = most;
  while (lo < hi) {
    const mid = midpoint(lo, hi);
    if (netFood(moveWorkers(s, from, 'gather', mid)) >= 0) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

const FOOD_SOURCES: readonly MoveSource[] = ['free', 'tend', 'forage', 'dig', 'guard'];
const CAPACITY_SOURCES: readonly MoveSource[] = ['free', 'tend'];

/**
 * The single most useful reallocation (Story 1.23), or null. It answers the
 * same critical states as the next-action rule (Story 1.21), sized for WRKR:
 *
 * - food critical → the fewest workers to GATHER that stop the loss, from the
 *   free pool, else TEND, FORAGE, DIG, then GUARD above the minimum;
 * - capacity critical → every free worker to DIG, else one from TEND.
 */
export function getReallocation(s: GameState): Reallocation | null {
  if (!workersOpen(s)) return null;
  if (isFoodCritical(s)) {
    const from = firstSource(s, FOOD_SOURCES);
    return from ? { rule: 'food', from, to: 'gather', count: fewestToStopLoss(s, from) } : null;
  }
  if (isCapacityCritical(s)) {
    const from = firstSource(s, CAPACITY_SOURCES);
    if (!from) return null;
    return { rule: 'capacity', from, to: 'dig', count: from === 'free' ? movable(s, from) : 1 };
  }
  return null;
}
