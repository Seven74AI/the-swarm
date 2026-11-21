import type { GameState } from '../state/GameState';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { MapSystem } from '../systems/MapSystem';
import type { TerritorySystem } from '../systems/TerritorySystem';
import { computeOfflineResourceDeltas } from '../systems/OfflineProgression';
import { EventQueue } from './events';
import { processTick } from './processTick';

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
 */
export function catchUp(state: GameState, effectiveMs: number, ticks: number, deps: CatchUpDeps): GameState {
  const totalDtSec = effectiveMs / 1000;
  const territoryBonuses = deps.territorySystem.getBonuses(state);
  const d = computeOfflineResourceDeltas(state, totalDtSec, territoryBonuses);

  let s: GameState = {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food + d.foodDelta,
      wood: state.resources.wood + d.woodDelta,
      stone: state.resources.stone + d.stoneDelta,
      nectar: state.resources.nectar + d.nectarDelta,
    },
    prestige: {
      ...state.prestige,
      totalFoodProduced: state.prestige.totalFoodProduced + d.grossFoodProduced,
    },
  };

  const events = new EventQueue();
  for (let i = 0; i < ticks; i++) {
    s = processTick(
      s, deps.resourceSystem, deps.soldierSystem, deps.mapSystem, deps.territorySystem, events, TICK_SEC,
      true, // skipDeterministicResources: added above in closed form
    );
    s = deps.latch(s);
    events.clear();
  }
  return s;
}
