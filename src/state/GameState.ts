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
  /** Countdown timers for each egg (ticks until hatch). */
  eggHatchTimers: number[];
  /** Countdown timers for each larva (ticks until mature). */
  larvaMatureTimers: number[];
  workersAssigned: {
    gather: number;
    tend: number;
    dig: number;
    guard: number;
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
  /** Countdown timers for soldier training (ticks until trained). */
  soldierTrainTimers: number[];
  /** Whether the colony has achieved transcendence victory. */
  victoryAchieved: boolean;
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
    eggHatchTimers: [],
    larvaMatureTimers: [],
    workersAssigned: {
      gather: 0,
      tend: 0,
      dig: 0,
      guard: 0,
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
    soldierTrainTimers: [],
    victoryAchieved: false,
  };
}
