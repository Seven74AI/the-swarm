import type { GameState } from '../state/GameState';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { MapSystem } from '../systems/MapSystem';
import type { TerritorySystem } from '../systems/TerritorySystem';
import { capOfflineMs, computeOfflineResourceDeltas } from '../systems/OfflineProgression';
import { EventQueue } from './events';
import { processTick } from './processTick';
import { creditWhole } from '../utils/math';

export interface CatchUpDeps {
  resourceSystem: ResourceSystem;
  soldierSystem: SoldierSystem;
  mapSystem: MapSystem;
  territorySystem: TerritorySystem;
  /** The phase latch (`PhaseStateMachine.latch`): catch-up may latch a goal, never commit it (D2). */
  latch: (state: GameState) => GameState;
}

/** The simulated tick length. */
const TICK_SEC = 50 / 1000;

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
 */
export function catchUp(state: GameState, ms: number, ticks: number, deps: CatchUpDeps): GameState {
  const effectiveMs = capOfflineMs(state, ms);
  const tickCount = Math.min(ticks, Math.floor(effectiveMs / (TICK_SEC * 1000)));
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

  const events = new EventQueue();
  for (let i = 0; i < tickCount; i++) {
    s = processTick(
      s, deps.resourceSystem, deps.soldierSystem, deps.mapSystem, deps.territorySystem, events, TICK_SEC,
      true, // skipDeterministicResources: added above in closed form
    );
    s = deps.latch(s);
    events.clear();
  }
  return s;
}
