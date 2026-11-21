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

/** A colony mutation — a one-time permanent bonus purchased with combat resources. */
export interface Mutation {
  id: string;
  /** Whether this mutation has been purchased. */
  purchased: boolean;
}

/** A met phase goal, latched until CONTINUE (Story 1.19). */
export interface PhaseGoal {
  /** The phase CONTINUE leads to (the `to` of the transition out of the current phase). */
  phase: string;
  latched: true;
  /** Game time (`stats.playTimeMs`) when the goal was first met. */
  atMs: number;
  /** Each condition's value when the goal was first met, by condition id (for `reached <value> at <time>`). */
  reached: Readonly<Record<string, number>>;
}

export interface GameState {
  phase: string;
  /** Whether the game is paused. Paused games stop all systems but save normally. */
  paused: boolean;
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
    /** Accumulates from completed space explorations. Each point speeds up future explorations by 5%. */
    surveyData: number;
  };
  /** Rate-based egg hatching pipeline (replaces eggHatchTimers[]) */
  eggPipeline: Pipeline;
  /** Rate-based larva maturation pipeline (replaces larvaMatureTimers[]) */
  larvaPipeline: Pipeline;
  /** Rate-based soldier training pipeline (replaces soldierTrainTimers[]) */
  soldierPipeline: Pipeline;
  /** Integer accumulator for nest capacity expansion. Incremented each tick by digCount.
   * When >= 20, converts to +1 nestCapacity. Ensures integer-only accumulation. */
  capacityAccumulator: number;
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
    silk_weaving: { level: number };
    chitin_armory: { level: number };
    venom_lab: { level: number };
  };
  territory: {
    ownedTiles: number;
    bonuses: Record<string, number>;
  };
  mapTiles: Tile[];
  /** Expeditions out in the field (AR23 lifecycle, game-time ms). */
  expeditions: Expedition[];
  /** Space explorations in flight (AR23 lifecycle, game-time ms). */
  spaceExplorations: SpaceExploration[];
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
  /** The most recent battle (AR23 lifecycle). */
  lastBattle: Battle;
  combatResources: {
    chitin: number;
    silk: number;
    venom: number;
  };
  battlesWon: number;
  battlesLost: number;
  /** Whether the colony has achieved transcendence victory. */
  victoryAchieved: boolean;
  /**
   * The goal latch (Story 1.19, D3, ADR 0003). Written once by
   * `PhaseStateMachine.latch` when the guard out of the current phase first
   * holds; it survives dips and saves, and only `commit` (CONTINUE) or
   * prestige clears it. Null while the goal is not met.
   */
  phaseGoal: PhaseGoal | null;
  /** Spaceship state (SPACE phase). */
  spaceship: {
    level: number;
    fuel: number;
    maxFuel: number;
  };
  /** Active space probes (SPACE phase, AR23 lifecycle). */
  spaceProbes: SpaceProbe[];
  /** Cosmic discoveries log (SPACE phase). */
  discoveries: string[];
  /** Monotonic ID counters to avoid module-level collision. */
  nextIds: {
    expedition: number;
    exploration: number;
    spaceship: number;
    probe: number;
  };
  /** Prestige system — Legacy Layer (Phase 5+). */
  prestige: {
    /** Number of times the player has prestiged. */
    count: number;
    /** Accumulated Legacy Points across all prestiges. */
    legacyPoints: number;
    /** Lifetime total food produced (never reset). */
    totalFoodProduced: number;
    /** Lifetime total wood produced (never reset). */
    totalWoodProduced: number;
    /** Lifetime total stone produced (never reset). */
    totalStoneProduced: number;
    /** Lifetime total nectar produced (never reset). */
    totalNectarProduced: number;
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
  /** Prestige Tree permanent upgrade purchases. Survives Full Wipe. */
  prestigeTree: {
    /** IDs of purchased prestige upgrades (never reset). */
    purchased: string[];
  };
  /** Colony mutations — one-time permanent bonuses purchased with combat resources. Survives prestige. */
  mutations: Mutation[];
}

export type ResearchProjectId = 'voidCrystalSynthesis' | 'antimatterContainment' | 'darkMatterDetection';

/** Display status of a research project. `locked`/`available` are derived from prerequisites. */
export type ResearchProjectStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/*
 * Lifecycle state (AR23). Anything that starts, runs and ends is a
 * discriminated union on `status`, timed in game-time milliseconds (never
 * wall clock), made by pure factories with sequential or content IDs, and
 * plain JSON. A collection entry that resolves in the tick it ends (an
 * expedition, an exploration) is removed then, so only `running` is stored.
 */

/** A research project: not started, running, or finished. */
export type ResearchProject =
  | { status: 'idle' }
  | { status: 'running'; progressMs: number; durationMs: number }
  | { status: 'done' };

export interface ResearchState {
  projects: Record<ResearchProjectId, ResearchProject>;
}

/** An expedition of scouts and warriors (Expansion). */
export interface Expedition {
  id: string;
  status: 'running';
  scouts: number;
  warriors: number;
  destination: string;
  remainingMs: number;
  durationMs: number;
  risk: number;
}

/** A space exploration (Space). */
export interface SpaceExploration {
  id: string;
  status: 'running';
  destination: string;
  remainingMs: number;
  durationMs: number;
  risk: number;
}

/** A probe sent to a planet (Space). */
export interface SpaceProbe {
  id: string;
  status: 'running';
  destination: string;
  scouts: number;
  remainingMs: number;
  durationMs: number;
}

/** The most recent battle. Battles resolve instantly, so there is no running state. */
export type Battle =
  | { status: 'idle' }
  | {
      status: 'done';
      enemyType: string;
      result: 'victory' | 'defeat' | 'draw';
      soldiersLost: number;
      foodGained: number;
      /** Game time (stats.playTimeMs) when the battle was fought. */
      atMs: number;
    };

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
    paused: false,
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
      surveyData: 0,
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
      silk_weaving: { level: 0 },
      chitin_armory: { level: 0 },
      venom_lab: { level: 0 },
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
    lastBattle: { status: 'idle' },
    combatResources: {
      chitin: 0,
      silk: 0,
      venom: 0,
    },
    battlesWon: 0,
    battlesLost: 0,
    soldierPipeline: { count: 0, progress: 0 },
    capacityAccumulator: 0,
    victoryAchieved: false,
    phaseGoal: null,
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
      probe: 1,
    },
    prestige: {
      count: 0,
      legacyPoints: 0,
      totalFoodProduced: 0,
      totalWoodProduced: 0,
      totalStoneProduced: 0,
      totalNectarProduced: 0,
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
        voidCrystalSynthesis: { status: 'idle' },
        antimatterContainment: { status: 'idle' },
        darkMatterDetection: { status: 'idle' },
      },
    },
    conversions: {
      particleLab: 0,
    },
    entropy: 0,
    entropyDampener: { level: 0 },
    prestigeTree: {
      purchased: [],
    },
    mutations: [
      { id: 'efficient_gatherers', purchased: false },
      { id: 'swift_soldiers', purchased: false },
      { id: 'accelerated_hatching', purchased: false },
      { id: 'tough_shells', purchased: false },
      { id: 'potent_venom', purchased: false },
      { id: 'reinforced_mandibles', purchased: false },
    ],
  };
}
