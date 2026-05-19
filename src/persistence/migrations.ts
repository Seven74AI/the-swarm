import type { SaveData } from './SaveManager';
import type { GameState } from '../state/GameState';

/**
 * Migration system for save data version upgrades.
 *
 * Each migration function transforms a SaveData from one version to the next.
 * The `migrateSave` function chains migrations to go from `from` to `to`.
 */

/** v1 → v2: adds population convenience field + expansion fields (resources, soldiers, buildings, territory, expeditions) */
function migrateV1toV2(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    population?: number;
    wood?: number;
    stone?: number;
    nectar?: number;
    soldiers?: { scouts: number; warriors: number; totalKilled: number };
    buildings?: {
      barracks: { level: number; count: number };
      walls: { level: number };
      warehouse: { level: number };
    };
    territory?: { ownedTiles: number; bonuses: Record<string, number> };
    expeditions?: Array<{
      id: string;
      scouts: number;
      warriors: number;
      destination: string;
      ticksRemaining: number;
      risk: number;
    }>;
  };

  // Existing population field
  gameState.population = gameState.resources.workers;

  // Expansion resources
  gameState.resources = {
    ...gameState.resources,
    wood: gameState.resources.wood ?? 0,
    stone: gameState.resources.stone ?? 0,
    nectar: gameState.resources.nectar ?? 0,
  };

  // Expansion data structures
  gameState.soldiers = gameState.soldiers ?? {
    scouts: 0,
    warriors: 0,
    totalKilled: 0,
  };

  gameState.buildings = gameState.buildings ?? {
    barracks: { level: 0, count: 0 },
    walls: { level: 0 },
    warehouse: { level: 0 },
  };

  gameState.territory = gameState.territory ?? {
    ownedTiles: 0,
    bonuses: {},
  };

  gameState.expeditions = gameState.expeditions ?? [];

  return {
    ...data,
    version: 2,
    gameState,
  };
}

/** Registry of migration functions keyed by source version */
const MIGRATIONS: Record<number, (data: SaveData) => SaveData> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
};

/** v3 → v4: adds space exploration fields (spaceExplorations, discoveredPlanets) */
function migrateV3toV4(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    spaceExplorations?: unknown;
    discoveredPlanets?: unknown;
  };

  gameState.spaceExplorations = gameState.spaceExplorations ?? [];
  gameState.discoveredPlanets = gameState.discoveredPlanets ?? [];

  return {
    ...data,
    version: 4,
    gameState,
  };
}

/** v2 → v3: adds space phase resources (voidCrystals, antimatter, darkMatter) */
function migrateV2toV3(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    resources: {
      voidCrystals?: number;
      antimatter?: number;
      darkMatter?: number;
    };
  };

  gameState.resources = {
    ...gameState.resources,
    voidCrystals: gameState.resources.voidCrystals ?? 0,
    antimatter: gameState.resources.antimatter ?? 0,
    darkMatter: gameState.resources.darkMatter ?? 0,
  };

  return {
    ...data,
    version: 3,
    gameState,
  };
}

/**
 * Migrate save data from one version to another by chaining version steps.
 * Returns unchanged data if from >= to or no migrations defined.
 */
export function migrateSave(
  data: SaveData,
  from: number,
  to: number,
): SaveData {
  if (from >= to) return data;

  let current = data;
  for (let v = from; v < to; v++) {
    const migrateFn = MIGRATIONS[v];
    if (migrateFn) {
      current = migrateFn(current);
    }
  }
  return current;
}
