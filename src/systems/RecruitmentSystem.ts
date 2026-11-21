import type { GameState } from '../state/GameState';
import { getEffects } from './BuildingSystem';

/**
 * RecruitmentSystem handles Phase 3 Expansion scout/warrior recruitment.
 * Scouts and warriors are recruited from workers (not independent population).
 * Requires barracks building.
 */
/** Food to recruit one scout / warrior. */
export const SCOUT_FOOD_COST = 50;
export const WARRIOR_FOOD_COST = 100;
/** Barracks level that unlocks scouts / warriors. */
export const SCOUT_BARRACKS_LEVEL = 1;
export const WARRIOR_BARRACKS_LEVEL = 2;

export function getMaxScouts(state: GameState): number {
  const effects = getEffects('barracks', state.buildings.barracks.level);
  return effects.scoutsCap ?? 0;
}

export function getMaxWarriors(state: GameState): number {
  const effects = getEffects('barracks', state.buildings.barracks.level);
  return effects.warriorsCap ?? 0;
}

export function recruitScout(state: GameState): GameState {
  if (state.buildings.barracks.level < SCOUT_BARRACKS_LEVEL) return state;
  if (state.resources.workers < 1) return state;
  if (state.resources.food < SCOUT_FOOD_COST) return state;
  if (state.soldiers.scouts >= getMaxScouts(state)) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      workers: state.resources.workers - 1,
      food: state.resources.food - SCOUT_FOOD_COST,
    },
    soldiers: {
      ...state.soldiers,
      scouts: state.soldiers.scouts + 1,
    },
  };
}

export function recruitWarrior(state: GameState): GameState {
  if (state.buildings.barracks.level < WARRIOR_BARRACKS_LEVEL) return state;
  if (state.resources.workers < 1) return state;
  if (state.resources.food < WARRIOR_FOOD_COST) return state;
  if (state.soldiers.warriors >= getMaxWarriors(state)) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      workers: state.resources.workers - 1,
      food: state.resources.food - WARRIOR_FOOD_COST,
    },
    soldiers: {
      ...state.soldiers,
      warriors: state.soldiers.warriors + 1,
    },
  };
}
