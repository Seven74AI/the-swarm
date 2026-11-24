import type { GameState } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { starvationBalance } from '../data/balance/starvation';
import { MS_PER_SEC } from '../data/constants';
import { hashString, keyedStream } from '../utils/rng';
import { getAssignedWorkers, netFoodOf } from './ResourceSystem';
import type { WorkerRole } from './ResourceSystem';

/**
 * Starvation (Story 9.16, FR61, FR4): warns, then shrinks the colony to fit.
 * While food is at zero and the colony eats more than it makes, the clock
 * runs; after the grace one eater dies every death interval, a worker or a
 * soldier, chosen by their counts from a stream keyed by the seed and the
 * death's number (so any step length picks the same order). Deaths stop as
 * soon as production covers use, which also stops and resets the clock.
 * Eggs, larvae and the queen never starve. Pure functions.
 */

const ROLES: readonly WorkerRole[] = ['gather', 'forage', 'tend', 'dig', 'guard'];
const STARVE_KEY = hashString('starvation');

/** The colony's eaters: workers, and soldiers trained or in training. */
export function eaters(s: GameState): number {
  return s.resources.workers + s.combatSoldiers + s.soldierPipeline.count;
}

/** Starving now: food at zero, and the colony eats more than it makes. */
export function isStarvingNow(s: GameState, bonuses?: TerritoryBonuses): boolean {
  return s.resources.food <= 0 && netFoodOf(s, bonuses) < 0;
}

/** How much the Pantry rooms stretch the grace and the interval: at most `pantryMaxFactor`. */
function pantryFactor(s: GameState): number {
  const pantries = Math.max(0, s.roomJobs.jobs.pantry ?? 0);
  return Math.min(starvationBalance.pantryMaxFactor, 1 + starvationBalance.perPantry * pantries);
}

/** Time at zero food before the first death. */
export function graceMs(s: GameState): number {
  return Math.floor(starvationBalance.graceMs * pantryFactor(s));
}

/** Time between deaths while starving. */
export function deathIntervalMs(s: GameState): number {
  return Math.floor(starvationBalance.deathIntervalMs * pantryFactor(s));
}

/** Deaths due after `ms` of one starving stretch. */
function dueAfter(s: GameState, ms: number): number {
  const grace = graceMs(s);
  return ms < grace ? 0 : Math.floor((ms - grace) / deathIntervalMs(s)) + 1;
}

/** Who dies next: a worker or a soldier, by their counts, from the seeded stream for death number `n`. */
function victim(s: GameState, n: number): 'worker' | 'soldier' {
  const w = s.resources.workers;
  const a = s.combatSoldiers + s.soldierPipeline.count;
  if (a <= 0) return 'worker';
  if (w <= 0) return 'soldier';
  const roll = keyedStream(STARVE_KEY, s.seed, s.prestige.count, n).float();
  return roll * (w + a) < w ? 'worker' : 'soldier';
}

/** One worker dies: off the free pool first, then off the role with the most on it (roles never exceed workers). */
function removeWorker(s: GameState): GameState {
  const workers = s.resources.workers - 1;
  let assigned = s.workersAssigned;
  if (getAssignedWorkers(s) > workers) {
    const role = ROLES.reduce((best, r) => (assigned[r] > assigned[best] ? r : best), ROLES[0]);
    assigned = { ...assigned, [role]: assigned[role] - 1 };
  }
  return { ...s, resources: { ...s.resources, workers }, workersAssigned: assigned };
}

/** One soldier dies: a trained one first, else one in training. */
function removeSoldier(s: GameState): GameState {
  if (s.combatSoldiers > 0) return { ...s, combatSoldiers: s.combatSoldiers - 1 };
  return { ...s, soldierPipeline: { ...s.soldierPipeline, count: s.soldierPipeline.count - 1 } };
}

/** The next eater in the death order dies; the run counts it. */
function kill(s: GameState): GameState {
  const n = s.starvation.starvedWorkers + s.starvation.starvedSoldiers;
  const kind = victim(s, n);
  const out = kind === 'worker' ? removeWorker(s) : removeSoldier(s);
  return {
    ...out,
    starvation: {
      ...s.starvation,
      starvedWorkers: s.starvation.starvedWorkers + (kind === 'worker' ? 1 : 0),
      starvedSoldiers: s.starvation.starvedSoldiers + (kind === 'soldier' ? 1 : 0),
    },
  };
}

/** Where the colony settles (Story 9.16, 9.17): its eaters after removing them in the death order until its food rate is zero or better. */
export interface Settle {
  readonly workers: number;
  readonly soldiers: number;
  readonly netFoodPerSec: number;
}

/**
 * The largest colony reached by removing eaters in the death order (the next
 * deaths, free workers first) whose net food rate is zero or better. A colony
 * already fed settles where it is. Pure.
 */
export function getSettlesAt(s: GameState, bonuses?: TerritoryBonuses): Settle {
  let cur = s;
  while (netFoodOf(cur, bonuses) < 0 && eaters(cur) > 0) cur = kill(cur);
  return { workers: cur.resources.workers, soldiers: cur.combatSoldiers + cur.soldierPipeline.count, netFoodPerSec: netFoodOf(cur, bonuses) };
}

export interface StarvationOptions {
  readonly bonuses?: TerritoryBonuses;
  /** Catch-up (Story 9.16): the run's death count may not pass this (at most 20% of the eaters before the absence die). */
  readonly maxDeaths?: number;
}

/**
 * Advance the starvation clock by `dtSec`: deaths come due by the clock alone
 * (the grace, then one an interval), and each one happens only while the
 * colony still starves and stays above the floor. The clock resets once the
 * colony no longer starves. One spread write; returns `s` when nothing changes.
 */
export function tickStarvation(s: GameState, dtSec: number, opts: StarvationOptions = {}): GameState {
  if (!isStarvingNow(s, opts.bonuses)) {
    return s.starvation.ms === 0 && s.starvation.stretchDeaths === 0 ? s : { ...s, starvation: { ...s.starvation, ms: 0, stretchDeaths: 0 } };
  }
  const ms = s.starvation.ms + Math.round(dtSec * MS_PER_SEC);
  let cur: GameState = { ...s, starvation: { ...s.starvation, ms } };
  const due = dueAfter(cur, ms);
  const cap = opts.maxDeaths ?? Infinity;
  while (cur.starvation.stretchDeaths < due) {
    if (!isStarvingNow(cur, opts.bonuses) || cur.starvation.starvedWorkers + cur.starvation.starvedSoldiers >= cap) break;
    const next = kill(cur);
    cur = { ...next, starvation: { ...next.starvation, stretchDeaths: cur.starvation.stretchDeaths + 1 } };
  }
  if (!isStarvingNow(cur, opts.bonuses)) cur = { ...cur, starvation: { ...cur.starvation, ms: 0, stretchDeaths: 0 } };
  return cur;
}
