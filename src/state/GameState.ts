export interface GameState {
  phase: string;
  resources: {
    eggs: number;
    larvae: number;
    workers: number;
    food: number;
    nestCapacity: number;
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
  upgrades: Record<string, number>;
  stats: {
    totalEggsLaid: number;
    totalClicks: number;
    playTimeMs: number;
  };
  unlockedPanels: string[];
  lastSaveTimestamp: number;
  // Combat phase fields
  soldiers: number;
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
    },
    eggHatchTimers: [],
    larvaMatureTimers: [],
    workersAssigned: {
      gather: 0,
      tend: 0,
      dig: 0,
      guard: 0,
    },
    upgrades: {},
    stats: {
      totalEggsLaid: 0,
      totalClicks: 0,
      playTimeMs: 0,
    },
    unlockedPanels: [],
    lastSaveTimestamp: 0,
    // Combat defaults
    soldiers: 0,
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
