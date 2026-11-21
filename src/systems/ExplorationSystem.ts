import type { GameState, SpaceExploration, SpaceProbe } from '../state/GameState';
import { PLANETS, type PlanetDef } from '../data/planets';
import { STREAM_KEYS, hashString, intBetween, keyedStream, pick, type RngStream } from '../utils/rng';

/** Key the keyed streams of explorations and probe launches apart (Story 3.1). */
const EXPLORATION_KEY = STREAM_KEYS.exploration;
const PROBE_TICK_KEY = STREAM_KEYS.probeTick;
const PROBE_PLANET_KEY = STREAM_KEYS.probePlanet;

/**
 * The rolls of one exploration (Story 3.1): fixed by the game's seed, the run
 * (prestige count) and the exploration's id, so it comes back the same
 * whatever the step length or the order it resolves in.
 */
export function explorationRolls(state: GameState, exploration: SpaceExploration): RngStream {
  return keyedStream(state.seed, state.prestige.count, EXPLORATION_KEY, hashString(exploration.id));
}

export const MAX_ACTIVE_EXPLORATIONS = 3;

/** Probes the player can have out at once. */
export const MAX_PROBES = 3;

/** Game-time length of one simulation tick; distances below are counted in ticks. */
const TICK_MS = 50;

/** Survey data scaling: each point gives 5% speed boost to exploration distance. */
export const SURVEY_DATA_SPEED_MULTIPLIER = 0.05;

/** Survey data threshold to activate probe swarm auto-launching. */
export const PROBE_SWARM_THRESHOLD = 10;

/** Survey data gained per successful exploration completion. */
export const SURVEY_DATA_PER_EXPLORATION = 1;


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

/** Pure factory: a new running exploration with the next sequential id. */
export function createExploration(state: GameState, destination: string): SpaceExploration {
  const durationMs = getScaledDistance(destination, state.resources.surveyData) * TICK_MS;
  return {
    id: `spc_${state.nextIds.exploration}`,
    status: 'running',
    destination,
    remainingMs: durationMs,
    durationMs,
    risk: calculateRisk(destination),
  };
}

/** Pure factory: a new running probe with the next sequential id. */
export function createProbe(state: GameState, destination: string, scouts: number): SpaceProbe {
  const durationMs = getScaledDistance(destination, state.resources.surveyData) * TICK_MS;
  return {
    id: `probe_${state.nextIds.probe}`,
    status: 'running',
    destination,
    scouts,
    remainingMs: durationMs,
    durationMs,
  };
}

/**
 * Send a probe: needs the ship, a scout and a free probe slot. Returns the
 * same state when it can't launch.
 */
export function launchProbe(state: GameState, destination: string): GameState {
  const scouts = 1;
  if (state.spaceship.level <= 0) return state;
  if (state.soldiers.scouts < scouts) return state;
  if (state.spaceProbes.length >= MAX_PROBES) return state;

  return {
    ...state,
    nextIds: { ...state.nextIds, probe: state.nextIds.probe + 1 },
    soldiers: { ...state.soldiers, scouts: state.soldiers.scouts - scouts },
    spaceProbes: [...state.spaceProbes, createProbe(state, destination, scouts)],
  };
}

export function launchExploration(
  state: GameState,
  destination: string,
): GameState {
  // Max explorations check
  if (state.spaceExplorations.length >= MAX_ACTIVE_EXPLORATIONS) return state;

  const exploration = createExploration(state, destination);

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

/** Count every running exploration down by the tick's game time. */
export function tickExplorations(state: GameState, dtSec: number): GameState {
  if (state.spaceExplorations.length === 0) return state;
  const dtMs = Math.round(dtSec * 1000);

  return {
    ...state,
    spaceExplorations: state.spaceExplorations.map((exp) => ({
      ...exp,
      remainingMs: exp.remainingMs - dtMs,
    })),
  };
}

export function resolveExploration(
  state: GameState,
  exploration: SpaceExploration,
  rng: RngStream = explorationRolls(state, exploration),
): GameState {
  const idx = state.spaceExplorations.findIndex((e) => e.id === exploration.id);
  if (idx === -1) return state;

  const roll = rng.float();
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
    const anomalyRoll = rng.float();
    if (anomalyRoll < 0.05) {
      // Anomaly: bonus voidCrystals
      result = {
        ...result,
        resources: {
          ...result.resources,
          voidCrystals: result.resources.voidCrystals + intBetween(rng, 1, 5),
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
 * Each tick of game time launches with a chance. The roll for a tick is fixed
 * by the game's seed, the run and that tick's number (Story 3.1), and the
 * planet by the seed and the new exploration's id, so one long step launches
 * exactly what many short ones would (Story 2.5), with no draw per call.
 *
 * Returns the updated state, or the same state if no auto-launch occurred.
 */
export function tickProbeSwarm(state: GameState, dtSec: number): GameState {
  const ticks = Math.round(Math.round(dtSec * 1000) / TICK_MS);
  const firstTick = Math.round(state.stats.playTimeMs / TICK_MS);
  let s = state;
  for (let i = 0; i < ticks; i++) {
    const surveyData = s.resources.surveyData;
    if (surveyData < PROBE_SWARM_THRESHOLD) return s;
    // Already at max active explorations — nothing to do
    if (s.spaceExplorations.length >= MAX_ACTIVE_EXPLORATIONS) return s;

    // Chance per tick when swarm is active: 5% + 0.5% per surveyData above threshold
    const chance = Math.min(1, 0.05 + (surveyData - PROBE_SWARM_THRESHOLD) * 0.005);
    const roll = keyedStream(s.seed, s.prestige.count, PROBE_TICK_KEY, firstTick + i).float();
    if (roll >= chance) continue;

    // Auto-launch to a random planet
    const id = `spc_${s.nextIds.exploration}`;
    const planet = pick(keyedStream(s.seed, s.prestige.count, PROBE_PLANET_KEY, hashString(id)), PLANETS);
    s = launchExploration(s, planet.name);
  }
  return s;
}
