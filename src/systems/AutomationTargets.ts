import type { AutomationTarget, GameState } from '../state/GameState';
import type { EventSink } from '../engine/events';
import type { TerritoryBonuses } from './TerritorySystem';
import { PHASE_ORDER, type Phase } from '../phases/phases';
import { automationBalance } from '../data/balance/automation';
import { soldierBalance } from '../data/balance/soldiers';
import { combatBalance } from '../data/balance/combat';
import { automationVerb, type AutomationBlock, type AutomationVerb } from '../data/content/automation';
import { eggsPerTap, isStarving } from './ResourceSystem';
import { freeWorkers } from './Workforce';
import { trainSoldiers } from './SoldierSystem';
import {
  SCOUT_BARRACKS_LEVEL,
  SCOUT_FOOD_COST,
  WARRIOR_BARRACKS_LEVEL,
  WARRIOR_FOOD_COST,
  getMaxScouts,
  getMaxWarriors,
  recruitMany,
} from './RecruitmentSystem';

/**
 * Automation targets (Story 4.10, FR16, UX-DR16, ADR 0039). Pure functions.
 *
 * A verb the player has done by hand (`AUTOMATION_VERBS`) becomes
 * automatable after `targets.unlockAfterManual` manual performances, or from
 * the phase after the one that introduced it. Its row holds a target and an
 * AUTO switch; with AUTO on, every step (live or offline: it runs inside
 * `processTick`) works the count toward the target and never past it:
 *
 * - `lay`: the queen lays on her own, at `layTapsPerSec` taps' worth of
 *   eggs a second, while the brood (eggs and larvae waiting) is under target.
 * - `train`: free workers go to training while the army (trained and in
 *   training) is under target, paid as TRAIN SOLDIER pays.
 * - `scout`, `warrior`: free workers are recruited while the scouts (or
 *   warriors) at home and away are under target, within the barracks cap.
 *
 * Automation spends only what the manual verb spends and never touches a
 * decision event (decisions stay the player's: GDD "Automation Systems").
 */

const T = automationBalance.targets;

const phaseIndex = (phase: string): number => PHASE_ORDER.indexOf(phase as Phase);

/** Whether the phase `phase` is at or after `from`. */
function reached(phase: string, from: Phase): boolean {
  return phaseIndex(phase) >= phaseIndex(from);
}

/** The verb's row appears: done by hand often enough, or the phase after its own reached. */
export function isAutomationUnlocked(state: GameState, verb: AutomationVerb): boolean {
  if (state.automation.performed[verb] >= T.unlockAfterManual) return true;
  const next = PHASE_ORDER[phaseIndex(automationVerb(verb).introducedIn) + 1];
  return next !== undefined && reached(state.phase, next);
}

/** The row shows: unlocked, and the verb's own screen is open (its phase reached). */
export function isAutomationShown(state: GameState, verb: AutomationVerb): boolean {
  return reached(state.phase, automationVerb(verb).introducedIn) && isAutomationUnlocked(state, verb);
}

/** The colony works this verb now: its row shows and AUTO is on. */
export function isAutomationActive(state: GameState, verb: AutomationVerb): boolean {
  return state.automation.targets[verb].on && isAutomationShown(state, verb);
}

/** Scouts or warriors away on an expedition. */
function away(state: GameState, kind: 'scouts' | 'warriors'): number {
  return state.expeditions.reduce((n, e) => n + e[kind], 0);
}

/** What a verb's target counts, now. */
export function automationCount(state: GameState, verb: AutomationVerb): number {
  switch (verb) {
    case 'lay':
      return state.eggPipeline.count + state.larvaPipeline.count;
    case 'train':
      return state.combatSoldiers + state.soldierPipeline.count;
    case 'scout':
      return state.soldiers.scouts + away(state, 'scouts');
    case 'warrior':
      return state.soldiers.warriors + away(state, 'warriors');
  }
}

/** The highest target a row may be set to. */
export function maxAutomationTarget(): number {
  return T.maxTarget;
}

/** Eggs a second the queen lays on her own while the brood is under target. */
export function autoLayPerSec(state: GameState): number {
  return T.layTapsPerSec * eggsPerTap(state.upgrades.click_power ?? 0);
}

/** How many more the colony could pay for now (the first limit hit names the block), capped at `wanted`. */
interface Affordable {
  readonly n: number;
  readonly block: AutomationBlock | null;
}

function affordable(state: GameState, verb: Exclude<AutomationVerb, 'lay'>, wanted: number, bonuses?: TerritoryBonuses): Affordable {
  let n = wanted;
  let block: AutomationBlock | null = null;
  const limit = (most: number, why: AutomationBlock) => {
    const m = Math.max(0, Math.floor(most));
    if (m < n) {
      n = m;
      block = why;
    }
  };
  if (verb === 'train') {
    limit(freeWorkers(state) / combatBalance.army.workersPerSoldier, 'no_free_workers');
    // A starving colony trains no one (Story 4.4), whatever is in store.
    limit(isStarving(state, bonuses) ? 0 : state.resources.food / soldierBalance.costFood, 'food_short');
    return { n, block };
  }
  const scout = verb === 'scout';
  const open = state.buildings.barracks.level >= (scout ? SCOUT_BARRACKS_LEVEL : WARRIOR_BARRACKS_LEVEL);
  const cap = open ? (scout ? getMaxScouts(state) - state.soldiers.scouts : getMaxWarriors(state) - state.soldiers.warriors) : 0;
  limit(cap, 'barracks_full');
  limit(freeWorkers(state), 'no_free_workers');
  limit(state.resources.food / (scout ? SCOUT_FOOD_COST : WARRIOR_FOOD_COST), 'food_short');
  return { n, block };
}

/** A row's status: holding at the target, working toward it, or blocked (with the reason). */
export type AutomationStatus =
  | { readonly kind: 'off' }
  | { readonly kind: 'holding'; readonly count: number }
  | { readonly kind: 'working'; readonly count: number; readonly target: number }
  | { readonly kind: 'blocked'; readonly count: number; readonly block: AutomationBlock };

export function automationStatus(state: GameState, verb: AutomationVerb, bonuses?: TerritoryBonuses): AutomationStatus {
  if (!isAutomationActive(state, verb)) return { kind: 'off' };
  const count = automationCount(state, verb);
  const target = state.automation.targets[verb].target;
  if (count >= target) return { kind: 'holding', count };
  if (verb === 'lay') return { kind: 'working', count, target };
  const a = affordable(state, verb, target - count, bonuses);
  return a.n > 0 || a.block === null ? { kind: 'working', count, target } : { kind: 'blocked', count, block: a.block };
}

/** The warn reason under a row, or null (holding, working or off). */
export function automationBlock(state: GameState, verb: AutomationVerb, bonuses?: TerritoryBonuses): AutomationBlock | null {
  const s = automationStatus(state, verb, bonuses);
  return s.kind === 'blocked' ? s.block : null;
}

/** One more manual performance of `verb`, folded into the action's own write. */
export function recordManual(state: GameState, verb: AutomationVerb): GameState {
  const a = state.automation;
  return { ...state, automation: { ...a, performed: { ...a.performed, [verb]: a.performed[verb] + 1 } } };
}

/** The row with `patch` applied (the target clamped to 0..maxTarget, whole). */
export function setAutomationTarget(state: GameState, verb: AutomationVerb, patch: Partial<AutomationTarget>): GameState {
  const a = state.automation;
  const row = { ...a.targets[verb], ...patch };
  const target = Math.min(T.maxTarget, Math.max(0, Math.floor(row.target)));
  return { ...state, automation: { ...a, targets: { ...a.targets, [verb]: { target, on: row.on } } } };
}

/** The queen lays toward the brood target: whole eggs, the fraction carried (any step length lays the same). */
function tickLay(state: GameState, dtSec: number): GameState {
  const a = state.automation;
  const room = a.targets.lay.target - automationCount(state, 'lay');
  if (!isAutomationActive(state, 'lay') || room <= 0) {
    return a.layProgress === 0 ? state : { ...state, automation: { ...a, layProgress: 0 } };
  }
  const progress = a.layProgress + autoLayPerSec(state) * dtSec;
  const eggs = Math.min(Math.floor(progress), room);
  // At the target the queen stops: no fraction is banked for a burst later.
  const layProgress = eggs === room ? 0 : progress - eggs;
  return {
    ...state,
    resources: { ...state.resources, eggs: state.resources.eggs + eggs },
    eggPipeline: { ...state.eggPipeline, count: state.eggPipeline.count + eggs },
    stats: { ...state.stats, totalEggsLaid: state.stats.totalEggsLaid + eggs },
    automation: { ...a, layProgress },
  };
}

/**
 * One step of every automation target (live and offline: `processTick`).
 * Runs after the step's production, so what this step brought in can pay.
 */
export function tickAutomationTargets(state: GameState, dtSec: number, events: EventSink, bonuses?: TerritoryBonuses): GameState {
  let s = tickLay(state, dtSec);
  if (isAutomationActive(s, 'train')) {
    const want = s.automation.targets.train.target - automationCount(s, 'train');
    const n = want > 0 ? affordable(s, 'train', want, bonuses).n : 0;
    if (n > 0) {
      s = trainSoldiers(s, n);
      events.emit('soldiers_changed', { soldiers: s.combatSoldiers });
    }
  }
  for (const verb of ['scout', 'warrior'] as const) {
    if (!isAutomationActive(s, verb)) continue;
    const want = s.automation.targets[verb].target - automationCount(s, verb);
    const n = want > 0 ? affordable(s, verb, want, bonuses).n : 0;
    if (n > 0) s = recruitMany(s, verb === 'scout' ? 'scouts' : 'warriors', n);
  }
  return s;
}
