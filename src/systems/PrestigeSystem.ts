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

/**
 * Get the production multiplier from Legacy Points.
 * Each point gives +2% additive bonus.
 *
 * Returns a multiplier (e.g., 1.0 for 0 points, 1.10 for 5 points).
 */
export function getProductionBonus(legacyPoints: number): number {
  return 1.0 + legacyPoints * 0.02;
}
