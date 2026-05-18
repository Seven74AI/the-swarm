export interface GameState {
  phase: string;
  resources: {
    eggs: number;
    larvae: number;
    workers: number;
    food: number;
    nestCapacity: number;
  };
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
  };
}
