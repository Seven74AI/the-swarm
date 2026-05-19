import type { GameState } from '../state/GameState';
import { clamp } from '../utils/math';

export const MAX_ACTIVE_EXPLORATIONS = 3;

interface PlanetDef {
  name: string;
  type: 'rocky' | 'gas' | 'ice' | 'habitable';
}

export const PLANETS: PlanetDef[] = [
  { name: 'MARS', type: 'rocky' },
  { name: 'SATURN', type: 'gas' },
  { name: 'EUROPA', type: 'ice' },
  { name: 'KEPLER-442B', type: 'habitable' },
];

interface SpaceExploration {
  id: string;
  destination: string;
  ticksRemaining: number;
  risk: number;
}

let nextSpaceId = 1;

function generateId(): string {
  return `spc_${Date.now()}_${nextSpaceId++}`;
}

function getPlanetType(destination: string): PlanetDef['type'] | null {
  const planet = PLANETS.find((p) => p.name === destination);
  return planet?.type ?? null;
}

function calculateRisk(destination: string): number {
  const type = getPlanetType(destination);
  switch (type) {
    case 'rocky':
      return 0.3;
    case 'gas':
      return 0.4;
    case 'ice':
      return 0.5;
    case 'habitable':
      return 0.6;
    default:
      return 0.4;
  }
}

function calculateDistance(destination: string): number {
  // Simulate interstellar distance: 40-120 ticks
  const hash = destination.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 40 + (hash % 81); // 40 to 120
}

export function launchExploration(
  state: GameState,
  destination: string,
): GameState {
  // Max explorations check
  if (state.spaceExplorations.length >= MAX_ACTIVE_EXPLORATIONS) return state;

  const risk = calculateRisk(destination);
  const distance = calculateDistance(destination);

  const exploration: SpaceExploration = {
    id: generateId(),
    destination,
    ticksRemaining: distance,
    risk,
  };

  const discoveredPlanets = state.discoveredPlanets.includes(destination)
    ? state.discoveredPlanets
    : [...state.discoveredPlanets, destination];

  return {
    ...state,
    spaceExplorations: [...state.spaceExplorations, exploration],
    discoveredPlanets,
  };
}

export function tickExplorations(state: GameState): GameState {
  if (state.spaceExplorations.length === 0) return state;

  return {
    ...state,
    spaceExplorations: state.spaceExplorations.map((exp) => ({
      ...exp,
      ticksRemaining: exp.ticksRemaining - 1,
    })),
  };
}

export function resolveExploration(
  state: GameState,
  exploration: SpaceExploration,
): GameState {
  const idx = state.spaceExplorations.findIndex((e) => e.id === exploration.id);
  if (idx === -1) return state;

  const roll = Math.random();
  const risk = exploration.risk;

  let result: GameState = { ...state };

  if (roll < risk) {
    // Failure: no rewards
    result = { ...result };
  } else if (roll < risk + 0.2) {
    // Partial success: reduced rewards
    result = addSpaceLoot(result, exploration.destination, 0.5);
  } else {
    // Full success: full rewards
    result = addSpaceLoot(result, exploration.destination, 1.0);
  }

  // Space anomaly check (5% chance after any non-failure result)
  if (roll >= risk) {
    const anomalyRoll = Math.random();
    if (anomalyRoll < 0.05) {
      // Anomaly: bonus voidCrystals
      result = {
        ...result,
        resources: {
          ...result.resources,
          voidCrystals: result.resources.voidCrystals + Math.floor(Math.random() * 5) + 1,
        },
      };
    }
  }

  // Remove the resolved exploration
  result = {
    ...result,
    spaceExplorations: result.spaceExplorations.filter((e) => e.id !== exploration.id),
  };

  return result;
}

function addSpaceLoot(
  state: GameState,
  destination: string,
  multiplier: number,
): GameState {
  const type = getPlanetType(destination);
  let voidCrystals = 0;
  let antimatter = 0;
  let darkMatter = 0;
  let food = 0;

  // Base food from any space expedition
  food = Math.floor(5 * multiplier);

  switch (type) {
    case 'rocky':
      antimatter = Math.floor(3 * multiplier);
      break;
    case 'gas':
      darkMatter = Math.floor(3 * multiplier);
      break;
    case 'ice':
      voidCrystals = Math.floor(3 * multiplier);
      break;
    case 'habitable':
      food = Math.floor(15 * multiplier);
      voidCrystals = Math.floor(2 * multiplier);
      break;
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food + food,
      voidCrystals: state.resources.voidCrystals + voidCrystals,
      antimatter: state.resources.antimatter + antimatter,
      darkMatter: state.resources.darkMatter + darkMatter,
    },
  };
}
