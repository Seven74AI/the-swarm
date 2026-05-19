import type { GameState } from '../state/GameState';
import { clamp } from '../utils/math';

export const MAX_ACTIVE_EXPEDITIONS = 3;

let nextId = 1;

function generateId(): string {
  return `exp_${Date.now()}_${nextId++}`;
}

interface Expedition {
  id: string;
  scouts: number;
  warriors: number;
  destination: string;
  ticksRemaining: number;
  risk: number;
}

function calculateRisk(
  warriors: number,
  wallsLevel: number,
  destination: string,
): number {
  // Base risk varies by destination type
  const upper = destination.toUpperCase();
  let baseRisk = 0.5;
  if (upper.includes('DANGER') || upper.includes('ENEMY')) baseRisk = 0.8;
  if (upper.includes('SAFE') || upper.includes('MEADOW')) baseRisk = 0.3;
  if (upper.includes('MOUNTAIN')) baseRisk = 0.6;
  if (upper.includes('FOREST')) baseRisk = 0.5;

  const risk =
    baseRisk * (1 - 0.1 * warriors) * (1 - 0.05 * wallsLevel);
  return clamp(risk, 0.1, 0.9);
}

function calculateDistance(destination: string): number {
  // Simulate distance: 30-90 ticks
  const hash = destination.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 30 + (hash % 61); // 30 to 90
}

export function launchExpedition(
  state: GameState,
  scouts: number,
  warriors: number,
  destination: string,
): GameState {
  // Max expeditions check
  if (state.expeditions.length >= MAX_ACTIVE_EXPEDITIONS) return state;

  // Need enough soldiers
  if (state.soldiers.scouts < scouts || state.soldiers.warriors < warriors) return state;

  // Need at least one soldier
  if (scouts < 0 || warriors < 0) return state;
  if (scouts === 0 && warriors === 0) return state;

  const risk = calculateRisk(warriors, state.buildings.walls.level, destination);
  const distance = calculateDistance(destination);

  const expedition: Expedition = {
    id: generateId(),
    scouts,
    warriors,
    destination,
    ticksRemaining: distance,
    risk,
  };

  return {
    ...state,
    soldiers: {
      ...state.soldiers,
      scouts: state.soldiers.scouts - scouts,
      warriors: state.soldiers.warriors - warriors,
    },
    expeditions: [...state.expeditions, expedition],
  };
}

export function tickExpeditions(state: GameState): GameState {
  if (state.expeditions.length === 0) return state;

  return {
    ...state,
    expeditions: state.expeditions.map((exp) => ({
      ...exp,
      ticksRemaining: exp.ticksRemaining - 1,
    })),
  };
}

export function resolveExpedition(
  state: GameState,
  expedition: Expedition,
): GameState {
  const idx = state.expeditions.findIndex((e) => e.id === expedition.id);
  if (idx === -1) return state;

  const roll = Math.random();
  const risk = expedition.risk;

  let result: GameState = { ...state };

  if (roll < risk) {
    // Failure: lose soldiers, no loot
    result = {
      ...result,
      soldiers: {
        ...result.soldiers,
        totalKilled: result.soldiers.totalKilled + expedition.scouts + expedition.warriors,
      },
    };
  } else if (roll < risk + 0.2) {
    // Partial success: some casualties, some loot
    const killed = Math.max(1, Math.floor((expedition.scouts + expedition.warriors) * risk));
    result = addLoot(result, expedition.destination, 0.5);
    result = {
      ...result,
      soldiers: {
        ...result.soldiers,
        totalKilled: result.soldiers.totalKilled + killed,
        scouts: result.soldiers.scouts + (expedition.scouts - killed),
        warriors: result.soldiers.warriors + expedition.warriors,
      },
    };
    result = discoverTiles(result, 1);
  } else {
    // Full success: all soldiers return, full loot
    result = addLoot(result, expedition.destination, 1.0);
    result = {
      ...result,
      soldiers: {
        ...result.soldiers,
        scouts: result.soldiers.scouts + expedition.scouts,
        warriors: result.soldiers.warriors + expedition.warriors,
      },
    };
    result = discoverTiles(result, 2);
  }

  // Remove the resolved expedition
  result = {
    ...result,
    expeditions: result.expeditions.filter((e) => e.id !== expedition.id),
  };

  return result;
}

function addLoot(
  state: GameState,
  destination: string,
  multiplier: number,
): GameState {
  const upper = destination.toUpperCase();
  let food = Math.floor(20 * multiplier);
  let wood = 0;
  let stone = 0;
  let nectar = 0;

  // Zone-specific loot
  if (upper.includes('FOREST')) wood = Math.floor(15 * multiplier);
  if (upper.includes('MOUNTAIN')) stone = Math.floor(15 * multiplier);
  if (upper.includes('MEADOW')) nectar = Math.floor(10 * multiplier);

  return {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food + food,
      wood: state.resources.wood + wood,
      stone: state.resources.stone + stone,
      nectar: state.resources.nectar + nectar,
    },
  };
}

function discoverTiles(state: GameState, count: number): GameState {
  return {
    ...state,
    territory: {
      ...state.territory,
      ownedTiles: state.territory.ownedTiles + count,
    },
  };
}
