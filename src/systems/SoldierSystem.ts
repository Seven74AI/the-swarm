import type { GameState } from '../state/GameState';
import { getEffects } from './BuildingSystem';

export function getMaxScouts(state: GameState): number {
  const effects = getEffects('barracks', state.buildings.barracks.level);
  return effects.scoutsCap ?? 0;
}

export function getMaxWarriors(state: GameState): number {
  const effects = getEffects('barracks', state.buildings.barracks.level);
  return effects.warriorsCap ?? 0;
}

export function recruitScout(state: GameState): GameState {
  // Need barracks (level >= 1)
  if (state.buildings.barracks.level < 1) return state;
  // Need a worker
  if (state.resources.workers < 1) return state;
  // Need 50 food
  if (state.resources.food < 50) return state;
  // Check cap
  if (state.soldiers.scouts >= getMaxScouts(state)) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      workers: state.resources.workers - 1,
      food: state.resources.food - 50,
    },
    soldiers: {
      ...state.soldiers,
      scouts: state.soldiers.scouts + 1,
    },
  };
}

export function recruitWarrior(state: GameState): GameState {
  // Need barracks level >= 2
  if (state.buildings.barracks.level < 2) return state;
  // Need a worker
  if (state.resources.workers < 1) return state;
  // Need 100 food
  if (state.resources.food < 100) return state;
  // Check cap
  if (state.soldiers.warriors >= getMaxWarriors(state)) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      workers: state.resources.workers - 1,
      food: state.resources.food - 100,
    },
    soldiers: {
      ...state.soldiers,
      warriors: state.soldiers.warriors + 1,
    },
  };
}
