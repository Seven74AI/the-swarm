export enum TileType {
  EMPTY = 'empty',
  FOREST = 'forest',
  MOUNTAIN = 'mountain',
  MEADOW = 'meadow',
  ENEMY_NEST = 'enemy_nest',
}

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  discovered: boolean;
  claimed: boolean;
}

/**
 * Pipeline for rate-based spawning (eggs→larvae, larvae→workers, training→soldiers).
 * Replaces per-item timer arrays with a continuous-flow model.
 */
export interface Pipeline {
  /** Total items in this pipeline waiting to complete */
  count: number;
  /** Fractional progress (accumulated rate). floor(progress) = items completed this frame. */
  progress: number;
}

export interface GameState {
  phase: string;
  resources: {
    eggs: number;
    larvae: number;
    workers: number;
    food: number;
    nestCapacity: number;
    wood: number;
    stone: number;
    nectar: number;
    voidCrystals: number;
    antimatter: number;
    darkMatter: number;
  };
  /** Rate-based egg hatching pipeline (replaces eggHatchTimers[]) */
  eggPipeline: Pipeline;
  /** Rate-based larva maturation pipeline (replaces larvaMatureTimers[]) */
  larvaPipeline: Pipeline;
  /** Rate-based soldier training pipeline (replaces soldierTrainTimers[]) */
  soldierPipeline: Pipeline;
  workersAssigned: {
    gather: number;
    tend: number;
    dig: number;
    guard: number;
    researchers: number;
  };
  soldiers: {
    scouts: number;
    warriors: number;
    totalKilled: number;
  };
  buildings: {
    barracks: { level: number; count: number };
    walls: { level: number };
    warehouse: { level: number };
  };
  territory: {
    ownedTiles: number;
    bonuses: Record<string, number>;
  };
  mapTiles: Tile[];
  expeditions: Array<{
    id: string;
    scouts: number;
    warriors: number;
    destination: string;
    ticksRemaining: number;
    risk: number;
  }>;
  spaceExplorations: Array<{
    id: string;
    destination: string;
    ticksRemaining: number;
    risk: number;
  }>;
  discoveredPlanets: string[];
  spaceships: Array<{
    id: string;
    type: 'scout_ship' | 'cruiser' | 'capital_ship';
    level: number;
    fuel: number;
    maxFuel: number;
    status: 'idle' | 'exploring' | 'returning';
    missionTicksRemaining: number;
    destinationName: string;
  }>;
  upgrades: Record<string, number>;
  stats: {
    totalEggsLaid: number;
    totalClicks: number;
    playTimeMs: number;
  };
  unlockedPanels: string[];
  lastSaveTimestamp: number;
  // Combat phase fields
  combatSoldiers: number;
  soldierStats: {
    strength: number;
    defense: number;
    speed: number;
    maxHp: number;
  };
  equipment: {
    weapon: number;
    armor: number;
  };
  lastBattle: {
    enemyType: string | null;
    result: 'pending' | 'victory' | 'defeat';
    soldiersLost: number;
    foodGained: number;
    timestamp: number;
  } | null;
  combatResources: {
    chitin: number;
    silk: number;
    venom: number;
  };
  battlesWon: number;
  battlesLost: number;
  /** Whether the colony has achieved transcendence victory. */
  victoryAchieved: boolean;
  /** Spaceship state (SPACE phase). */
  spaceship: {
    level: number;
    fuel: number;
    maxFuel: number;
  };
  /** Active space probes (SPACE phase). */
  spaceProbes: Array<{
    id: string;
    destination: string;
    ticksRemaining: number;
    scouts: number;
  }>;
  /** Cosmic discoveries log (SPACE phase). */
  discoveries: string[];
  /** Monotonic ID counters to avoid module-level collision. */
  nextIds: {
    expedition: number;
    exploration: number;
    spaceship: number;
  };
  /** Prestige system — Legacy Layer (Phase 5+). */
  prestige: {
    /** Number of times the player has prestiged. */
    count: number;
    /** Accumulated Legacy Points across all prestiges. */
    legacyPoints: number;
    /** Lifetime total food produced (never reset). */
    totalFoodProduced: number;
  };
  /** Automation system — research tree, buildings, auto-production (GM-3). */
  autoProduction: {
    enabled: boolean;
    researches: Record<string, boolean>;
    buildings: Record<string, number>;
    /** Fractional progress toward next auto egg (rate * dt accumulator). */
    progress: number;
  };
  /**
   * Offline progression efficiency multiplier (0.5 = 50%, 1.0 = 100%).
   * Default 50% for standard incremental convention.
   * Upgradable via Phase 5+ prestige upgrades.
   */
  offlineEfficiency: number;
  /** Research system state (GM-6). */
  research: ResearchState;
  /** Resource conversion system state (GM-4). */
  conversions: ConversionState;
  /** Entropy system (GM-10). Accumulates from darkMatter production, 0–100. */
  entropy: number;
  /** Entropy Dampener building — reduces entropy rate 20% per level. */
  entropyDampener: { level: number };
  /** Prestige system — number of times the player has prestiged (new system). */
  prestigeCount: number;
  /** Prestige system — accumulated Prestige Points earned. */
  prestigePoints: number;
  /** Prestige system — IDs of purchased prestige upgrades. */
  purchasedUpgrades: string[];
  /** Prestige system — total lifetime resources produced (never reset). O(1) tracking. */
  totalLifetimeResources: number;
}

export type ResearchProjectId = 'voidCrystalSynthesis' | 'antimatterContainment' | 'darkMatterDetection';

export type ResearchProjectStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface ResearchState {
  projects: Record<ResearchProjectId, {
    state: ResearchProjectStatus;
    progress: number;
  }>;
}

export interface ConversionState {
  /** Level of particle lab used for antimatter production (0 = not built) */
  particleLab: number;
}

/**
 * Create a default 8×8 map grid with all tiles undiscovered and unclaimed.
 * Tile types are assigned as EMPTY — the MapSystem will generate the real layout.
 */
export function createEmptyMap(): Tile[] {
  const tiles: Tile[] = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      tiles.push({ x, y, type: TileType.EMPTY, discovered: false, claimed: false });
    }
  }
  return tiles;
}

export function createInitialState(): GameState {
  return {
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
      voidCrystals: 0,
      antimatter: 0,
      darkMatter: 0,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
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
      totalKilled: 0,
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
    stats: {
      totalEggsLaid: 0,
      totalClicks: 0,
      playTimeMs: 0,
    },
    unlockedPanels: [],
    lastSaveTimestamp: 0,
    // Combat defaults
    combatSoldiers: 0,
    soldierStats: {
      strength: 1.0,
      defense: 1.0,
      speed: 5,
      maxHp: 10,
    },
    equipment: {
      weapon: 0,
      armor: 0,
    },
    lastBattle: null,
    combatResources: {
      chitin: 0,
      silk: 0,
      venom: 0,
    },
    battlesWon: 0,
    battlesLost: 0,
    soldierPipeline: { count: 0, progress: 0 },
    victoryAchieved: false,
    spaceship: {
      level: 0,
      fuel: 0,
      maxFuel: 100,
    },
    spaceProbes: [],
    discoveries: [],
    nextIds: {
      expedition: 1,
      exploration: 1,
      spaceship: 1,
    },
    prestige: {
      count: 0,
      legacyPoints: 0,
      totalFoodProduced: 0,
    },
    autoProduction: {
      enabled: false,
      researches: {},
      buildings: {
        nursery: 0,
        hatchery: 0,
        queens_chamber: 0,
      },
      progress: 0,
    },
    offlineEfficiency: 0.5,
    research: {
      projects: {
        voidCrystalSynthesis: { state: 'available', progress: 0 },
        antimatterContainment: { state: 'locked', progress: 0 },
        darkMatterDetection: { state: 'locked', progress: 0 },
      },
    },
    conversions: {
      particleLab: 0,
    },
    entropy: 0,
    entropyDampener: { level: 0 },
    prestigeCount: 0,
    prestigePoints: 0,
    purchasedUpgrades: [],
    totalLifetimeResources: 0,
  };
}
