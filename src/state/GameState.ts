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
  };
}
