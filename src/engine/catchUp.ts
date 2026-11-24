import type { GameState } from '../state/GameState';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { MapSystem } from '../systems/MapSystem';
import type { TerritorySystem } from '../systems/TerritorySystem';
import { capOfflineMs, computeOfflineResourceDeltas } from '../systems/OfflineProgression';
import { CATCH_UP_STEP_MS, TICK_MS } from '../data/constants';
import { log } from '../utils/log';
import { EventQueue } from './events';
import { processTick } from './processTick';
import { creditWhole } from '../utils/math';
import { applyOfflineRules, offlineDeathCap, offlineRulesFor } from './offlineRules';

export interface CatchUpDeps {
  resourceSystem: ResourceSystem;
  soldierSystem: SoldierSystem;
  mapSystem: MapSystem;
  territorySystem: TerritorySystem;
  /** The phase latch (`PhaseStateMachine.latch`): catch-up may latch a goal, never commit it (D2). */
  latch: (state: GameState) => GameState;
}


/**
 * Offline catch-up (GM-8), shared by resume-on-load and the dev time skip
 * (Story 1.34). Pure: returns the state after `effectiveMs` of absence.
 *
 * Deterministic resources (food, wood, stone, nectar) are added in one
 * closed-form step (rate × time); then `ticks` ticks run for the non-linear
 * parts (pipelines, battles, expeditions …) with those resources skipped.
 * Simulated ticks raise events into a collecting queue that is never flushed:
 * nothing plays or animates for catch-up (AR18).
 *
 * At most `getOfflineCapMs(state)` is simulated, whatever the caller asks for
 * (Story 2.4): `ms` is cut to the cap, and `ticks` to the ticks the cut time holds.
 *
 * Macro-steps (Story 2.6, D2/AR4): the `ticks × 50 ms` of game time are not
 * run tick by tick but in steps of `stepMs` (`CATCH_UP_STEP_MS`, 10 s) through
 * the same `processTick`, the last step taking what is left. A 24 h catch-up
 * stays within `CATCH_UP_MAX_STEPS` calls. One summary line is logged, not one
 * per step. Tests pass `stepMs` = 50 to compare with fine steps.
 *
 * Offline-only rules (Story 2.7, `offlineRules.ts`): no decision event spawns
 * or counts down, no phase commits (the latch may set), events are collected
 * and dropped, automation runs as configured, and after every step workers are
 * kept at or above the starvation floor fixed from the state before the absence.
 */
export function catchUp(
  state: GameState,
  ms: number,
  ticks: number,
  deps: CatchUpDeps,
  stepMs: number = CATCH_UP_STEP_MS,
): GameState {
  return catchUpWithReport(state, ms, ticks, deps, stepMs).state;
}

/** What a catch-up measured besides the state (Story 2.9): the offline summary's warn lines. */
export interface CatchUpReport {
  /** Whole ms of the simulated absence during which food stood at zero (upkeep outran it). */
  starvedMs: number;
  /** Ms after leaving when the food ran out (Story 9.16); null when it never did. */
  foodRanOutAfterMs: number | null;
  /** Workers who starved during the absence (Story 9.16: the summary's `<n> WORKERS LOST`). */
  starvedEaters: number;
}

/** The starvation options of one catch-up step from `done` for `stepLen` ms (Story 9.16). */
function starvingIn(runsOutAtMs: number | null, done: number, stepLen: number, maxDeaths: number): { allowed: boolean; dtSec?: number; maxDeaths: number } {
  if (runsOutAtMs === null || done + stepLen <= runsOutAtMs) return { allowed: false, maxDeaths };
  return { allowed: true, dtSec: (done + stepLen - Math.max(done, runsOutAtMs)) / 1000, maxDeaths };
}

/** When the closed-form food ran out (Story 9.16): ms into the absence, or null when it never did. */
function foodRunsOutMsOf(stock: number, foodDelta: number, effectiveMs: number): number | null {
  if (!(effectiveMs > 0) || !(foodDelta < 0)) return null;
  const at = (Math.max(0, stock) / -foodDelta) * effectiveMs;
  return at < effectiveMs ? Math.floor(at) : null;
}

/**
 * Ms of the `effectiveMs` absence during which food stood at zero (Story 2.9).
 * Food is credited in closed form (one net rate over the whole absence), so the
 * stock runs out at `stock / −net` and stays at zero for the rest of it.
 */
function starvedMsOf(stock: number, foodDelta: number, effectiveMs: number): number {
  if (!(effectiveMs > 0) || !(foodDelta < 0)) return 0;
  const netPerMs = foodDelta / effectiveMs;
  const lastsMs = Math.max(0, stock) / -netPerMs;
  return Math.max(0, Math.floor(effectiveMs - lastsMs));
}

/**
 * `catchUp`, plus what it measured on the way (Story 2.9): how long food stood at
 * zero. The measure lives here, not at the call sites; the state is `catchUp`'s.
 */
export function catchUpWithReport(
  state: GameState,
  ms: number,
  ticks: number,
  deps: CatchUpDeps,
  stepMs: number = CATCH_UP_STEP_MS,
): { state: GameState; report: CatchUpReport } {
  const effectiveMs = capOfflineMs(state, ms);
  const tickCount = Math.max(0, Math.min(ticks, Math.floor(effectiveMs / TICK_MS)));
  const simulatedMs = tickCount * TICK_MS;
  const step = stepMs > 0 ? stepMs : CATCH_UP_STEP_MS;
  const totalDtSec = effectiveMs / 1000;
  const territoryBonuses = deps.territorySystem.getBonuses(state);
  const d = computeOfflineResourceDeltas(state, totalDtSec, territoryBonuses);

  // Credited in whole units, the fractions carried (Story 2.5, as in a live tick).
  const rem = state.resourceRemainder;
  const food = creditWhole(state.resources.food, rem.food, d.foodDelta);
  const wood = creditWhole(state.resources.wood, rem.wood, d.woodDelta);
  const stone = creditWhole(state.resources.stone, rem.stone, d.stoneDelta);
  const nectar = creditWhole(state.resources.nectar, rem.nectar, d.nectarDelta);
  let s: GameState = {
    ...state,
    resources: {
      ...state.resources,
      food: food.amount,
      wood: wood.amount,
      stone: stone.amount,
      nectar: nectar.amount,
    },
    resourceRemainder: {
      food: food.remainder,
      wood: wood.remainder,
      stone: stone.remainder,
      nectar: nectar.remainder,
    },
    prestige: {
      ...state.prestige,
      totalFoodProduced: state.prestige.totalFoodProduced + d.grossFoodProduced,
    },
  };

  const rules = offlineRulesFor(state);
  const events = new EventQueue();
  let steps = 0;
  // Starvation (Story 9.16): food is credited in closed form above, so the clock may run only
  // once the stock would have run out; and at most a share of the eaters may die.
  // The run-out point as a share of the absence, on the clock this loop runs (simulated ms, which efficiency shortens).
  const foodRunsOutAtMs = foodRunsOutMsOf(state.resources.food + rem.food, d.foodDelta, effectiveMs);
  const runsOutAtSimMs = foodRunsOutAtMs === null || !(effectiveMs > 0) ? null : Math.floor((foodRunsOutAtMs / effectiveMs) * simulatedMs);
  const maxDeaths = state.starvation.starvedWorkers + state.starvation.starvedSoldiers + offlineDeathCap(state);
  for (let done = 0; done < simulatedMs; steps++) {
    const stepLen = Math.min(step, simulatedMs - done);
    s = processTick(
      s, deps.resourceSystem, deps.soldierSystem, deps.mapSystem, deps.territorySystem, events, stepLen / 1000,
      true, // skipDeterministicResources: added above in closed form
      undefined,
      // The step the food runs out in starves only for its part after that.
      starvingIn(runsOutAtSimMs, done, stepLen, maxDeaths),
    );
    s = applyOfflineRules(s, rules);
    s = deps.latch(s);
    events.clear();
    done += stepLen;
  }
  log.info('catch-up', `simulated ${simulatedMs} ms in ${steps} steps`, { effectiveMs, simulatedMs, steps, stepMs: step });
  const starvedMs = starvedMsOf(state.resources.food + rem.food, d.foodDelta, effectiveMs);
  const starvedEaters = s.starvation.starvedWorkers - state.starvation.starvedWorkers;
  return { state: s, report: { starvedMs, foodRanOutAfterMs: foodRunsOutAtMs, starvedEaters } };
}
