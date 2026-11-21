import { computed, type ReadonlySignal } from '@preact/signals-core';
import { gameState } from './gameSignal';
import type { GameState } from './GameState';
import { getEffects } from '../systems/BuildingSystem';
import { computeResourceRates } from '../systems/ResourceSystem';
import {
  getConversionDefs,
  getConversionRate,
  type ConversionId,
} from '../systems/ResourceConversionSystem';

/**
 * Slice selectors over the single game-state signal (ADR 0001, arch D5, #186).
 *
 * `gameState` is one signal: an effect that reads `gameState.value.x` re-runs on every write, 20 times a
 * second. A `computed` slice notifies its dependents only when the value it returns changes (`===`), so
 * an effect that reads `selectBuildings.value` stays quiet on a tick that only changes food.
 *
 * Rules:
 * - UI code reads state only through these selectors, never `gameState.value`.
 * - Slices return the state's own references; never build a fresh object or array here, or the
 *   selector notifies on every write. Derive primitives (numbers, booleans, strings) instead.
 * - Ticks write one new state with spreads; untouched slices keep their reference, which is what
 *   keeps their selectors quiet. Recycling or mutating state objects would break this.
 */

function slice<K extends keyof GameState>(key: K): ReadonlySignal<GameState[K]> {
  return computed(() => gameState.value[key]);
}

// --- Top-level slices -------------------------------------------------------------------------

export const selectPhase = slice('phase');
export const selectPaused = slice('paused');
export const selectResources = slice('resources');
export const selectEggPipeline = slice('eggPipeline');
export const selectLarvaPipeline = slice('larvaPipeline');
export const selectSoldierPipeline = slice('soldierPipeline');
export const selectWorkersAssigned = slice('workersAssigned');
export const selectSoldiers = slice('soldiers');
export const selectBuildings = slice('buildings');
export const selectTerritory = slice('territory');
export const selectMapTiles = slice('mapTiles');
export const selectExpeditions = slice('expeditions');
export const selectSpaceExplorations = slice('spaceExplorations');
export const selectDiscoveredPlanets = slice('discoveredPlanets');
export const selectSpaceships = slice('spaceships');
export const selectStats = slice('stats');
export const selectCombatSoldiers = slice('combatSoldiers');
export const selectSoldierStats = slice('soldierStats');
export const selectEquipment = slice('equipment');
export const selectLastBattle = slice('lastBattle');
export const selectCombatResources = slice('combatResources');
export const selectBattlesWon = slice('battlesWon');
export const selectBattlesLost = slice('battlesLost');
export const selectVictoryAchieved = slice('victoryAchieved');
export const selectSpaceship = slice('spaceship');
export const selectSpaceProbes = slice('spaceProbes');
export const selectDiscoveries = slice('discoveries');
export const selectPrestige = slice('prestige');
export const selectAutoProduction = slice('autoProduction');
export const selectOfflineEfficiency = slice('offlineEfficiency');
export const selectResearch = slice('research');
export const selectConversions = slice('conversions');
export const selectPrestigeTree = slice('prestigeTree');
export const selectMutations = slice('mutations');

// --- Derived slices (primitives, so they notify only when the number changes) ---------------

export const selectTotalClicks = computed(() => selectStats.value.totalClicks);
export const selectWorkers = computed(() => selectResources.value.workers);
export const selectNestCapacity = computed(() => selectResources.value.nestCapacity);
export const selectLarvae = computed(() => selectResources.value.larvae);
export const selectResearchers = computed(() => selectWorkersAssigned.value.researchers);

/** Base nest capacity plus the warehouse bonus (there is no `getEffectiveNestCapacity()`). */
export const selectEffectiveNestCapacity = computed(
  () =>
    selectResources.value.nestCapacity +
    (getEffects('warehouse', selectBuildings.value.warehouse.level).nestCapacity ?? 0),
);

/** Net food per second (unfloored, for rate display). Notifies only when the number changes. */
export const selectFoodRatePerSec = computed(() => {
  const rates = computeResourceRates(gameState.value);
  return rates.foodProducedPerSec - rates.foodConsumedPerSec;
});

/** Net food per second, floored (WRKR summary). Recomputes on every write, notifies only on change. */
export const selectNetFoodPerSec = computed(() => {
  return Math.floor(selectFoodRatePerSec.value);
});

// --- Parameterised slices ---------------------------------------------------------------------

const byPath = new Map<string, ReadonlySignal<unknown>>();

/**
 * A slice at a dot-notation path (for example `resources.food`). Cached per path, so every caller
 * shares one computed.
 */
export function selectByPath(path: string): ReadonlySignal<unknown> {
  let sel = byPath.get(path);
  if (!sel) {
    const keys = path.split('.');
    sel = computed(() => {
      let cur: unknown = gameState.value;
      for (const k of keys) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[k];
      }
      return cur;
    });
    byPath.set(path, sel);
  }
  return sel;
}

const conversionRates = new Map<ConversionId, ReadonlySignal<number>>();
const conversionCaps = new Map<ConversionId, ReadonlySignal<number>>();

/** Current rate of one conversion chain, per tick. */
export function selectConversionRate(id: ConversionId): ReadonlySignal<number> {
  let sel = conversionRates.get(id);
  if (!sel) {
    sel = computed(() => getConversionRate(gameState.value, id));
    conversionRates.set(id, sel);
  }
  return sel;
}

/** Rate cap of one conversion chain, per tick. */
export function selectConversionCap(id: ConversionId): ReadonlySignal<number> {
  let sel = conversionCaps.get(id);
  if (!sel) {
    const def = getConversionDefs().find((d) => d.id === id);
    sel = computed(() => (def ? def.getRateCap(gameState.value) : 0));
    conversionCaps.set(id, sel);
  }
  return sel;
}
