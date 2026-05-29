import type { GameState } from '../state/GameState';
import { clamp } from '../utils/math';
import { PLANETS, type PlanetDef } from '../data/planets';

export const MAX_ACTIVE_EXPLORATIONS = 3;

/** Survey data scaling: each point gives 5% speed boost to exploration distance. */
export const SURVEY_DATA_SPEED_MULTIPLIER = 0.05;

/** Survey data threshold to activate probe swarm auto-launching. */
export const PROBE_SWARM_THRESHOLD = 10;

/** Survey data gained per successful exploration completion. */
export const SURVEY_DATA_PER_EXPLORATION = 1;

interface SpaceExploration {
  id: string;
  destination: string;
  ticksRemaining: number;
  risk: number;
}

function generateId(state: GameState): string {
  return `spc_${Date.now()}_${state.nextIds.exploration}`;
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

/**
 * Apply survey data speed multiplier to reduce exploration distance.
 * More surveyData → shorter distances → faster exploration completion loop.
 * This is the "recursive" scaling: exploring makes you explore faster.
 */
export function getScaledDistance(destination: string, surveyData: number): number {
  const baseDistance = calculateDistance(destination);
  const multiplier = 1 + surveyData * SURVEY_DATA_SPEED_MULTIPLIER;
  return Math.max(10, Math.floor(baseDistance / multiplier));
}

export function launchExploration(
  state: GameState,
  destination: string,
): GameState {
  // Max explorations check
  if (state.spaceExplorations.length >= MAX_ACTIVE_EXPLORATIONS) return state;

  const risk = calculateRisk(destination);
  const distance = getScaledDistance(destination, state.resources.surveyData);

  const exploration: SpaceExploration = {
    id: generateId(state),
    destination,
    ticksRemaining: distance,
    risk,
  };

  const discoveredPlanets = state.discoveredPlanets.includes(destination)
    ? state.discoveredPlanets
    : [...state.discoveredPlanets, destination];

  return {
    ...state,
    nextIds: { ...state.nextIds, exploration: state.nextIds.exploration + 1 },
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
    // Partial success: reduced rewards, half surveyData
    result = addSpaceLoot(result, exploration.destination, 0.5);
    result = addSurveyData(result, 0.5);
  } else {
    // Full success: full rewards + full surveyData
    result = addSpaceLoot(result, exploration.destination, 1.0);
    result = addSurveyData(result, 1.0);
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

function addSurveyData(state: GameState, multiplier: number): GameState {
  const gain = Math.floor(SURVEY_DATA_PER_EXPLORATION * multiplier);
  if (gain <= 0) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      surveyData: state.resources.surveyData + gain,
    },
  };
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

/**
 * Probe Swarm passive: when surveyData >= PROBE_SWARM_THRESHOLD,
 * auto-launch explorations periodically. This follows the idle game
 * pattern where manual actions become automated as you progress.
 *
 * Returns the updated state, or the same state if no auto-launch occurred.
 */
export function tickProbeSwarm(state: GameState): GameState {
  const surveyData = state.resources.surveyData;
  if (surveyData < PROBE_SWARM_THRESHOLD) return state;

  // Already at max active explorations — nothing to do
  if (state.spaceExplorations.length >= MAX_ACTIVE_EXPLORATIONS) return state;

  // Base chance per tick when swarm is active: 5% + 0.5% per surveyData above threshold
  const chance = 0.05 + (surveyData - PROBE_SWARM_THRESHOLD) * 0.005;
  const roll = Math.random();
  if (roll >= chance) return state;

  // Auto-launch to a random planet
  const planet = PLANETS[Math.floor(Math.random() * PLANETS.length)];
  return launchExploration(state, planet.name);
}
