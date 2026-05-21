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

/** v5 → v6: adds spaceship, spaceProbes, and discoveries for the SPACE phase UI */
function migrateV5toV6(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    spaceship?: { level: number; fuel: number; maxFuel: number };
    spaceProbes?: Array<{
      id: string;
      destination: string;
      ticksRemaining: number;
      scouts: number;
    }>;
    discoveries?: string[];
  };

  gameState.spaceship = gameState.spaceship ?? { level: 0, fuel: 0, maxFuel: 100 };
  gameState.spaceProbes = gameState.spaceProbes ?? [];
  gameState.discoveries = gameState.discoveries ?? [];

  return {
    ...data,
    version: 6,
    gameState,
  };
}

/**
 * v3 → v4: adds space exploration fields (spaceExplorations, discoveredPlanets)
 * and victoryAchieved for transcendence victory condition.
 */
function migrateV3toV4(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    spaceExplorations?: unknown;
    discoveredPlanets?: unknown;
    victoryAchieved?: boolean;
  };

  gameState.spaceExplorations = gameState.spaceExplorations ?? [];
  gameState.discoveredPlanets = gameState.discoveredPlanets ?? [];
  gameState.victoryAchieved = gameState.victoryAchieved ?? false;

  return {
    ...data,
    version: 4,
    gameState,
  };
}

/** v4 → v5: adds spaceships array for Space phase spaceship system */
function migrateV4toV5(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    spaceships?: unknown[];
  };

  gameState.spaceships = gameState.spaceships ?? [];

  return {
    ...data,
    version: 5,
    gameState,
  };
}

/** v6 → v7: replaces per-item timer arrays with rate-based pipelines */
function migrateV6toV7(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    eggHatchTimers?: number[];
    larvaMatureTimers?: number[];
    soldierTrainTimers?: number[];
    eggPipeline?: { count: number; progress: number };
    larvaPipeline?: { count: number; progress: number };
    soldierPipeline?: { count: number; progress: number };
  };

  gameState.eggPipeline = gameState.eggPipeline ?? { count: 0, progress: 0 };
  gameState.larvaPipeline = gameState.larvaPipeline ?? { count: 0, progress: 0 };
  gameState.soldierPipeline = gameState.soldierPipeline ?? { count: 0, progress: 0 };
  delete gameState.eggHatchTimers;
  delete gameState.larvaMatureTimers;
  delete gameState.soldierTrainTimers;

  return { ...data, version: 7, gameState };
}

/** v7 → v8: adds prestige (GM-1) + autoProduction (GM-3) + research system (GM-6) */
function migrateV7toV8(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    prestige?: { count: number; legacyPoints: number; totalFoodProduced: number };
    autoProduction?: {
      enabled: boolean;
      researches: Record<string, boolean>;
      buildings: Record<string, number>;
      progress: number;
    };
    workersAssigned?: {
      gather: number;
      tend: number;
      dig: number;
      guard: number;
      researchers?: number;
    };
    research?: {
      projects: Record<string, { state: string; progress: number }>;
    };
  };

  // GM-1: Prestige fields
  gameState.prestige = gameState.prestige ?? { count: 0, legacyPoints: 0, totalFoodProduced: 0 };

  // GM-3: Automation fields
  gameState.autoProduction = gameState.autoProduction ?? {
    enabled: false,
    researches: {},
    buildings: {
      nursery: 0,
      hatchery: 0,
      queens_chamber: 0,
    },
    progress: 0,
  };

  // GM-6: Researchers worker role
  if (gameState.workersAssigned) {
    gameState.workersAssigned = {
      ...gameState.workersAssigned,
      researchers: gameState.workersAssigned.researchers ?? 0,
    };
  }

  // GM-6: Research system state
  gameState.research = gameState.research ?? {
    projects: {
      voidCrystalSynthesis: { state: 'available', progress: 0 },
      antimatterContainment: { state: 'locked', progress: 0 },
      darkMatterDetection: { state: 'locked', progress: 0 },
    },
  };

  return { ...data, version: 8, gameState };
}

/** v8 → v9: adds resource conversion state (GM-4) */
function migrateV8toV9(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    conversions?: { particleLab: number };
  };

  gameState.conversions = gameState.conversions ?? { particleLab: 0 };

  return { ...data, version: 9, gameState };
}

/** v9 → v10: adds entropy system state (GM-10) */
function migrateV9toV10(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    entropy?: number;
    entropyDampener?: { level: number };
  };

  gameState.entropy = gameState.entropy ?? 0;
  gameState.entropyDampener = gameState.entropyDampener ?? { level: 0 };

  return { ...data, version: 10, gameState };
}

/** Registry of migration functions keyed by source version */
const MIGRATIONS: Record<number, (data: SaveData) => SaveData> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
  5: migrateV5toV6,
  6: migrateV6toV7,
  7: migrateV7toV8,
  8: migrateV8toV9,
  9: migrateV9toV10,
};

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
