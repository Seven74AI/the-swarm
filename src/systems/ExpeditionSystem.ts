import type { Expedition, GameState } from '../state/GameState';
import { clamp } from '../utils/math';
import { STREAM_KEYS, chance, hashString, keyedStream, type RngStream } from '../utils/rng';

/** Keys an expedition's outcome stream apart from the other keyed streams. */
const EXPEDITION_KEY = STREAM_KEYS.expedition;

/**
 * The rolls of one expedition (Story 3.1): fixed by the game's seed, the run
 * (prestige count) and the expedition's id, so an expedition comes home the
 * same whatever the step length or the order it resolves in.
 */
export function expeditionRolls(state: GameState, expedition: Expedition): RngStream {
  return keyedStream(state.seed, state.prestige.count, EXPEDITION_KEY, hashString(expedition.id));
}

export const MAX_ACTIVE_EXPEDITIONS = 3;

/** Game-time length of one simulation tick; distances below are counted in ticks. */
const TICK_MS = 50;

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

/**
 * Pure factory: a new running expedition with the next sequential id.
 * Does not check soldiers or slots; `launchExpedition` does.
 */
export function createExpedition(
  state: GameState,
  scouts: number,
  warriors: number,
  destination: string,
): Expedition {
  const durationMs = calculateDistance(destination) * TICK_MS;
  return {
    id: `exp_${state.nextIds.expedition}`,
    status: 'running',
    scouts,
    warriors,
    destination,
    remainingMs: durationMs,
    durationMs,
    risk: calculateRisk(warriors, state.buildings.walls.level, destination),
  };
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

  const expedition = createExpedition(state, scouts, warriors, destination);

  return {
    ...state,
    nextIds: { ...state.nextIds, expedition: state.nextIds.expedition + 1 },
    soldiers: {
      ...state.soldiers,
      scouts: state.soldiers.scouts - scouts,
      warriors: state.soldiers.warriors - warriors,
    },
    expeditions: [...state.expeditions, expedition],
  };
}

/** Count every running expedition down by the tick's game time. */
export function tickExpeditions(state: GameState, dtSec: number): GameState {
  if (state.expeditions.length === 0) return state;
  const dtMs = Math.round(dtSec * 1000);

  return {
    ...state,
    expeditions: state.expeditions.map((exp) => ({
      ...exp,
      remainingMs: exp.remainingMs - dtMs,
    })),
  };
}

export function resolveExpedition(
  state: GameState,
  expedition: Expedition,
  rng: RngStream = expeditionRolls(state, expedition),
): GameState {
  const idx = state.expeditions.findIndex((e) => e.id === expedition.id);
  if (idx === -1) return state;

  const roll = rng.float();
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
    const totalInExp = expedition.scouts + expedition.warriors;
    const rawKilled = Math.max(1, Math.floor(totalInExp * risk));
    // Distribute casualties proportionally between scouts and warriors
    const scoutKilled = Math.min(expedition.scouts, Math.ceil(rawKilled * expedition.scouts / totalInExp));
    const warriorKilled = Math.min(expedition.warriors, rawKilled - scoutKilled);
    const actualKilled = scoutKilled + warriorKilled;
    result = addLoot(result, expedition.destination, 0.5, rng);
    result = {
      ...result,
      soldiers: {
        ...result.soldiers,
        totalKilled: result.soldiers.totalKilled + actualKilled,
        scouts: result.soldiers.scouts + (expedition.scouts - scoutKilled),
        warriors: result.soldiers.warriors + (expedition.warriors - warriorKilled),
      },
    };
    result = discoverTiles(result, 1);
  } else {
    // Full success: all soldiers return, full loot
    result = addLoot(result, expedition.destination, 1.0, rng);
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
  rng: RngStream,
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
      // Rare space resource drops (10% chance each)
      voidCrystals: state.resources.voidCrystals + (chance(rng, 0.1) ? 1 : 0),
      antimatter: state.resources.antimatter + (chance(rng, 0.1) ? 1 : 0),
      darkMatter: state.resources.darkMatter + (chance(rng, 0.1) ? 1 : 0),
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
