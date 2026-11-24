import type { GameState } from '../state/GameState';
import { TerritorySystem, type TerritoryBonuses } from './TerritorySystem';
import { starvationBalance } from '../data/balance/starvation';
import { MS_PER_SEC } from '../data/constants';
import { hashString, keyedStream } from '../utils/rng';
import { foodParts, netFoodOf } from './ResourceSystem';
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

const STARVE_KEY = hashString('starvation');
const territory = new TerritorySystem();

/** The colony's eaters: workers, and soldiers trained or in training. */
export function eaters(s: GameState): number {
  return s.resources.workers + s.combatSoldiers + s.soldierPipeline.count;
}

/** Starving now: food at zero, and the colony eats more than it makes. */
export function isStarvingNow(s: GameState, bonuses?: TerritoryBonuses): boolean {
  // Territory counts as in the simulation (the UI passes none): the same answer everywhere.
  return s.resources.food <= 0 && netFoodOf(s, bonuses ?? territory.getBonuses(s)) < 0;
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

/** The clock of a stretch held at its last death: one interval short of the next. */
function heldAt(s: GameState): number {
  const d = s.starvation.stretchDeaths;
  return d === 0 ? Math.min(s.starvation.ms, graceMs(s) - 1) : graceMs(s) + (d - 1) * deathIntervalMs(s);
}

/** Deaths due after `ms` of one starving stretch. */
function dueAfter(s: GameState, ms: number): number {
  const grace = graceMs(s);
  return ms < grace ? 0 : Math.floor((ms - grace) / deathIntervalMs(s)) + 1;
}

/** Roles that bring in no food (Gather does): a worker on one eats and makes nothing to eat. */
const NON_FOOD_ROLES: readonly WorkerRole[] = ['forage', 'tend', 'dig', 'guard'];

/**
 * The eaters whose death raises the food rate (Story 9.16: shrink to fit,
 * never wipe): free workers while an idle worker eats more than it makes,
 * workers on a role that brings in no food, and soldiers. Gatherers, and
 * free workers who feed themselves, never starve: their death would only
 * deepen the hunger.
 */
function candidates(s: GameState, bonuses?: TerritoryBonuses): { readonly free: number; readonly roles: number; readonly soldiers: number } {
  const p = foodParts(s, bonuses ?? territory.getBonuses(s));
  const share = p.counts.workers > 0 ? p.in.territory / p.counts.workers : 0;
  const idleMakes = p.counts.idle > 0 ? p.in.idle / p.counts.idle : 0;
  const free = p.perWorkerEats > idleMakes + share ? p.counts.idle : 0;
  const roles = p.perWorkerEats > share ? NON_FOOD_ROLES.reduce((n, r) => n + s.workersAssigned[r], 0) : 0;
  const soldiers = p.perSoldierEats > 0 ? s.combatSoldiers + s.soldierPipeline.count : 0;
  return { free, roles, soldiers };
}

/** One worker dies: off the free pool first, else off a non-food role picked by its count from the stream. */
function removeWorker(s: GameState, fromFree: boolean, roll: number): GameState {
  const workers = s.resources.workers - 1;
  if (fromFree) return { ...s, resources: { ...s.resources, workers } };
  const total = NON_FOOD_ROLES.reduce((n, r) => n + s.workersAssigned[r], 0);
  let left = roll * total;
  let role = NON_FOOD_ROLES.find((r) => s.workersAssigned[r] > 0)!;
  for (const r of NON_FOOD_ROLES) {
    if (left < s.workersAssigned[r]) {
      role = r;
      break;
    }
    left -= s.workersAssigned[r];
  }
  return { ...s, resources: { ...s.resources, workers }, workersAssigned: { ...s.workersAssigned, [role]: s.workersAssigned[role] - 1 } };
}

/** One soldier dies: a trained one first, else one in training. */
function removeSoldier(s: GameState): GameState {
  if (s.combatSoldiers > 0) return { ...s, combatSoldiers: s.combatSoldiers - 1 };
  return { ...s, soldierPipeline: { ...s.soldierPipeline, count: s.soldierPipeline.count - 1 } };
}

/**
 * The next eater in the death order dies, a worker or a soldier picked by
 * their counts (among those whose death helps) from the stream keyed by the
 * seed and the death's number; the run counts it. Null when no death would help.
 */
function kill(s: GameState, bonuses?: TerritoryBonuses): GameState | null {
  const c = candidates(s, bonuses);
  const workers = c.free + c.roles;
  if (workers + c.soldiers <= 0) return null;
  const n = s.starvation.starvedWorkers + s.starvation.starvedSoldiers;
  const rng = keyedStream(STARVE_KEY, s.seed, s.prestige.count, n);
  const isWorker = rng.float() * (workers + c.soldiers) < workers;
  const out = isWorker ? removeWorker(s, c.free > 0, rng.float()) : removeSoldier(s);
  return {
    ...out,
    starvation: {
      ...s.starvation,
      starvedWorkers: s.starvation.starvedWorkers + (isWorker ? 1 : 0),
      starvedSoldiers: s.starvation.starvedSoldiers + (isWorker ? 0 : 1),
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
  // Deaths never change the territory: its bonuses are read once (Story 9.17 reads this from the sheet).
  const b = bonuses ?? territory.getBonuses(s);
  let cur = s;
  while (netFoodOf(cur, b) < 0) {
    const next = kill(cur, b);
    if (!next) break;
    cur = next;
  }
  return { workers: cur.resources.workers, soldiers: cur.combatSoldiers + cur.soldierPipeline.count, netFoodPerSec: netFoodOf(cur, b) };
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
    const next = kill(cur, opts.bonuses);
    if (!next) break;
    cur = { ...next, starvation: { ...next.starvation, stretchDeaths: cur.starvation.stretchDeaths + 1 } };
  }
  if (!isStarvingNow(cur, opts.bonuses)) return { ...cur, starvation: { ...cur.starvation, ms: 0, stretchDeaths: 0 } };
  // Deaths held back (the away cap, or no death that would help): the clock waits at the last death, so
  // no backlog of deaths falls due at once later.
  if (cur.starvation.stretchDeaths < due) cur = { ...cur, starvation: { ...cur.starvation, ms: heldAt(cur) } };
  return cur;
}
