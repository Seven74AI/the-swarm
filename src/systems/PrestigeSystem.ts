import { createEmptyMap, type GameState } from '../state/GameState';

/**
 * Map phase names to their numeric position.
 * egg_laying=1, colony=2, combat=3, expansion=4, space=5, transcendence=6
 */
const PHASE_NUMBER: Record<string, number> = {
  egg_laying: 1,
  colony: 2,
  combat: 3,
  expansion: 4,
  space: 5,
  transcendence: 6,
};

/**
 * Get the phase score — sum of all reached phase numbers.
 * For example, if current phase is 'space' (5), phaseScore = 1+2+3+4+5 = 15.
 */
function getPhaseScore(currentPhase: string): number {
  const n = PHASE_NUMBER[currentPhase] ?? 1;
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    sum += i;
  }
  return sum;
}

/**
 * Check whether prestige is available for the current game state.
 * Requirements:
 *   - All colony buildings at level 5+
 *   - 100K+ total food produced (lifetime)
 */
export function isPrestigeAvailable(state: GameState): boolean {
  const buildings = state.buildings;
  if (buildings.barracks.level < 5) return false;
  if (buildings.walls.level < 5) return false;
  if (buildings.warehouse.level < 5) return false;
  if (state.prestige.totalFoodProduced < 100_000) return false;
  return true;
}

/**
 * Return a list of unmet prestige requirements.
 */
export function getUnmetRequirements(state: GameState): string[] {
  const unmet: string[] = [];
  if (state.buildings.barracks.level < 5) unmet.push('barracks level 5+');
  if (state.buildings.walls.level < 5) unmet.push('walls level 5+');
  if (state.buildings.warehouse.level < 5) unmet.push('warehouse level 5+');
  if (state.prestige.totalFoodProduced < 100_000) unmet.push('100K total food produced');
  return unmet;
}

/**
 * Calculate Legacy Points gained from a prestige reset.
 * Formula: floor(log10(totalFoodProduced) * phaseScore / 100)
 */
export function calculateLegacyPoints(
  totalFoodProduced: number,
  phaseScore: number,
): number {
  if (totalFoodProduced < 10) return 0;
  return Math.floor(Math.log10(totalFoodProduced) * phaseScore / 100);
}

/**
 * Execute the prestige reset.
 *
 * Returns a new GameState with:
 *   - All Phase 1-4 resources set to starting values
 *   - Phase 5+ resources preserved (voidCrystals, antimatter, darkMatter)
 *   - Buildings, upgrades, workers, soldiers reset to zero
 *   - Prestige count incremented
 *   - Legacy Points added based on formula
 *   - totalFoodProduced preserved (never resets)
 *   - Phase set to egg_laying
 */
export function prestige(state: GameState): GameState {
  const phaseScore = getPhaseScore(state.phase);
  const newLegacyPoints = calculateLegacyPoints(
    state.prestige.totalFoodProduced,
    phaseScore,
  );

  return {
    ...state,
    phase: 'egg_laying',
    resources: {
      eggs: 0,
      larvae: 0,
      workers: 0,
      food: 0,
      nestCapacity: 25,
      wood: 0,
      stone: 0,
      nectar: 0,
      voidCrystals: state.resources.voidCrystals,
      antimatter: state.resources.antimatter,
      darkMatter: state.resources.darkMatter,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    soldierPipeline: { count: 0, progress: 0 },
    workersAssigned: {
      gather: 0,
      tend: 0,
      dig: 0,
      guard: 0,
      researchers: 0,
    },
    soldiers: {
      scouts: 0,
      warriors: 0,
      totalKilled: state.soldiers.totalKilled,
    },
    buildings: {
      barracks: { level: 0, count: 0 },
      walls: { level: 0 },
      warehouse: { level: 0 },
    },
    territory: {
      ownedTiles: 0,
      bonuses: {},
    },
    mapTiles: createEmptyMap(),
    expeditions: [],
    spaceExplorations: [],
    discoveredPlanets: [],
    spaceships: [],
    upgrades: {},
    combatSoldiers: 0,
    lastBattle: null,
    combatResources: {
      chitin: 0,
      silk: 0,
      venom: 0,
    },
    spaceship: {
      level: 0,
      fuel: 0,
      maxFuel: 100,
    },
    prestige: {
      count: state.prestige.count + 1,
      legacyPoints: state.prestige.legacyPoints + newLegacyPoints,
      totalFoodProduced: state.prestige.totalFoodProduced,
    },
  };
}

/** GM-8 Offline efficiency prestige upgrades */

/** Cost: 10 Legacy Points. Requirement: offlineEfficiency at 50%. Result: 75%. */
export const TEMPORAL_RESONANCE_COST = 10;
/** Cost: 5 Void Crystals. Requirement: offlineEfficiency at 75%. Result: 100%. */
export const CHRONO_SYNCHRONIZATION_COST = 5;

/**
 * Check if the player can buy the Temporal Resonance upgrade.
 * Requires: phase transcendence+, legacyPoints >= 10, offlineEfficiency === 0.5.
 */
export function canBuyTemporalResonance(state: GameState): boolean {
  if (state.phase !== 'transcendence' && state.phase !== 'egg_laying') return false;
  if (state.prestige.legacyPoints < TEMPORAL_RESONANCE_COST) return false;
  if (state.offlineEfficiency !== 0.5) return false;
  return true;
}

/**
 * Buy Temporal Resonance: offline efficiency 50% → 75%.
 * Returns new state, or null if requirements not met.
 */
export function buyTemporalResonance(state: GameState): GameState | null {
  if (!canBuyTemporalResonance(state)) return null;
  return {
    ...state,
    offlineEfficiency: 0.75,
    prestige: {
      ...state.prestige,
      legacyPoints: state.prestige.legacyPoints - TEMPORAL_RESONANCE_COST,
    },
  };
}

/**
 * Check if the player can buy the Chrono-Synchronization upgrade.
 * Requires: offlineEfficiency === 0.75, voidCrystals >= 5.
 * Available in any phase after Transcendence (including prestige resets to egg_laying).
 */
export function canBuyChronoSynchronization(state: GameState): boolean {
  if (state.resources.voidCrystals < CHRONO_SYNCHRONIZATION_COST) return false;
  if (state.offlineEfficiency !== 0.75) return false;
  return true;
}

/**
 * Buy Chrono-Synchronization: offline efficiency 75% → 100%.
 * Returns new state, or null if requirements not met.
 */
export function buyChronoSynchronization(state: GameState): GameState | null {
  if (!canBuyChronoSynchronization(state)) return null;
  return {
    ...state,
    offlineEfficiency: 1.0,
    resources: {
      ...state.resources,
      voidCrystals: state.resources.voidCrystals - CHRONO_SYNCHRONIZATION_COST,
    },
  };
}

/**
 * Get the production multiplier from Legacy Points.
 * Each point gives +2% additive bonus.
 *
 * Returns a multiplier (e.g., 1.0 for 0 points, 1.10 for 5 points).
 */
export function getProductionBonus(legacyPoints: number): number {
  return 1.0 + legacyPoints * 0.02;
}
