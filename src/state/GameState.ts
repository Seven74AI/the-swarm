import { soldierBalance } from '../data/balance/soldiers';
import { DEFAULT_SEED } from './seed';
import { rngFromSeed } from '../utils/rng';
import { peekEnemy } from '../systems/EnemySystem';
import type { EnemyType } from '../data/content/enemies';
import type { DecisionId } from '../data/content/decisions';
import type { AutomationVerb } from '../data/content/automation';
import { automationBalance } from '../data/balance/automation';
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

/**
 * The open decision event (Story 1.28, N3). `remainingMs` is game time left on
 * its countdown, in the event's own time (the `double` timer setting slows the
 * countdown; it doesn't change this number); `null` for an untimed event.
 * `roll` (0–1) is drawn at spawn and decides any risk, so the outcome is fixed
 * while the event waits, across saves.
 */
export interface OpenDecision {
  id: DecisionId;
  remainingMs: number | null;
  /** Session clock when it opened (a reloaded event keeps the old session's value). */
  openedAtSessionMs: number;
  roll: number;
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

/** One automation target row: keep `target` (whole, ≥ 0), worked toward only while `on`. */
export interface AutomationTarget {
  target: number;
  on: boolean;
}

/** Story 4.10: what the colony has learned by hand, and what it keeps. */
export interface AutomationState {
  performed: Record<AutomationVerb, number>;
  targets: Record<AutomationVerb, AutomationTarget>;
  layProgress: number;
}

/** No verb learned, every row at its default target with AUTO off. */
export function initialAutomation(): AutomationState {
  const t = (): AutomationTarget => ({ target: automationBalance.targets.defaultTarget, on: false });
  return {
    performed: { lay: 0, train: 0, scout: 0, warrior: 0 },
    targets: { lay: t(), train: t(), scout: t(), warrior: t() },
    layProgress: 0,
  };
}

export interface GameState {
  phase: string;
  /**
   * The seed this game runs with (Story 1.34, D6): an unsigned 32-bit integer,
   * shown in the debug overlay and exported with diagnostics. Story 3.1 seeds
   * the generator from it.
   */
  seed: number;
  /**
   * The seeded generator's state (Story 3.1, ADR 0005): an unsigned 32-bit
   * integer, advanced by every random draw (battles, enemies, decisions, the
   * map). Starts from `rngFromSeed(seed)`; prestige keeps it running.
   */
  rng: number;
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
  /** Dig progress toward the next nest room, in dig-worker ticks: each dig worker
   * adds one per 50 ms of game time (any step length, Story 2.5); 20 make +1 nestCapacity. */
  capacityAccumulator: number;
  /** Fractions of a unit carried between steps for the resources credited at a rate
   * (Story 2.5, AR20): the resources themselves stay whole numbers. Each in [0, 1). */
  resourceRemainder: ResourceRemainder;
  workersAssigned: {
    gather: number;
    /** Foragers bring in nectar (Story 3.4, save v26). */
    forage: number;
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
    /** Story 4.7: gatherers bring in more food. */
    fungus_garden: { level: number };
    /** Story 4.7: diggers dig rooms faster. */
    tunnels: { level: number };
    silk_weaving: { level: number };
    chitin_armory: { level: number };
    venom_lab: { level: number };
    /** Story 4.8: where the fallen go; each soldier lost leaves chitin. */
    midden: { level: number };
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
    /**
     * Battles won across every run (Story 5.5, save v33): LOG's lifetime
     * tally. `battlesWon` is this run's count, the Combat goal, reset by prestige.
     */
    totalBattlesWon: number;
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
  /**
   * The enemy the next battle fights, shown on the enemy card before the
   * player commits (Story 4.1, FR12). Drawn from the seeded generator by the
   * battle before it (the first from the starting generator state), so a
   * reload shows the same enemy. Prestige keeps it, as it keeps battles won.
   */
  nextEnemy: EnemyType;
  /** Whether the colony has achieved transcendence victory. */
  victoryAchieved: boolean;
  /**
   * The goal latch (Story 1.19, D3, ADR 0003). Written once by
   * `PhaseStateMachine.latch` when the guard out of the current phase first
   * holds; it survives dips and saves, and only `commit` (CONTINUE) or
   * prestige clears it. Null while the goal is not met.
   */
  phaseGoal: PhaseGoal | null;
  /**
   * Decision events (Story 1.28, D8). `open` is saved, so an open event comes
   * back after a reload with the same time left. `nextSpawnSessionMs` is on the
   * session clock (foreground play since this launch); every launch resets it
   * to `null` (drawn on the first foreground tick).
   */
  decision: {
    open: OpenDecision | null;
    nextSpawnSessionMs: number | null;
  };
  /**
   * What survives every run (arch D4). `revealsSeen`: the phases whose reveal
   * has played to the end once (Story 1.20); from then on it can be skipped.
   * Prestige keeps it.
   */
  lifetime: {
    revealsSeen: string[];
    /**
     * The phases a run has moved out of (Story 5.6, FR32, save v34): `commit`
     * adds each one, prestige keeps the list. Phase Skip never starts a run
     * past the first phase not in it.
     */
    phasesCompleted: string[];
  };
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
    /** Legacy Points held: earned by prestiges, minus what Legacy upgrades cost. */
    legacyPoints: number;
    /**
     * Every Legacy Point ever earned, spent or not (Story 5.2, FR29): a
     * prestige adds its award here and to `legacyPoints`; a Legacy purchase
     * spends only `legacyPoints`. The production bonus reads this, so buying
     * an upgrade never lowers it.
     */
    lifetimeLpEarned: number;
    /** Lifetime total food produced (never reset). */
    totalFoodProduced: number;
    /** Lifetime total wood produced (never reset). */
    totalWoodProduced: number;
    /** Lifetime total stone produced (never reset). */
    totalStoneProduced: number;
    /** Lifetime total nectar produced (never reset). */
    totalNectarProduced: number;
  };
  /**
   * Automation targets (Story 4.10, FR16, ADR 0039). `performed` counts each
   * verb done by hand (the unlock rule; prestige keeps it, the player has
   * learned the verb). `targets` holds each row's `KEEP N` and its AUTO
   * switch. `layProgress` is the fraction of an egg the queen has laid on
   * her own toward the next one.
   */
  automation: AutomationState;
  /** Automation system — research tree, buildings, auto-production (GM-3). */
  autoProduction: {
    enabled: boolean;
    researches: Record<string, boolean>;
    buildings: Record<string, number>;
    /** Fractional progress toward next auto egg (rate * dt accumulator). */
    progress: number;
  };
  /** Research system state (GM-6). */
  research: ResearchState;
  /** Resource conversion system state (GM-4). */
  conversions: ConversionState;
  /**
   * Entropy system (GM-10). Accumulates from darkMatter production, 0–100.
   * A meter, not a resource (Story 3.3): it may hold a fraction, is shown
   * rounded (`entropyMeter`) and is never spent; only prestige resets it.
   */
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

export type ResearchProjectId = 'voidCrystalSynthesis' | 'antimatterContainment' | 'darkMatterDetection' | 'dormantForaging';

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
  /** Progress toward each conversion's next run, carried between steps (Story 2.5). Each in [0, 1). */
  remainder: Record<'voidCrystalSynthesis' | 'antimatterContainment' | 'darkMatterDetection', number>;
}

/** Carried fractions of the rate-credited resources (Story 2.5). */
export interface ResourceRemainder {
  food: number;
  wood: number;
  stone: number;
  nectar: number;
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
    seed: DEFAULT_SEED,
    rng: rngFromSeed(DEFAULT_SEED),
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
      forage: 0,
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
      fungus_garden: { level: 0 },
      tunnels: { level: 0 },
      silk_weaving: { level: 0 },
      chitin_armory: { level: 0 },
      venom_lab: { level: 0 },
      midden: { level: 0 },
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
      totalBattlesWon: 0,
    },
    unlockedPanels: [],
    lastSaveTimestamp: 0,
    // Combat defaults
    combatSoldiers: 0,
    soldierStats: {
      strength: soldierBalance.baseStrength,
      defense: soldierBalance.baseDefense,
      speed: soldierBalance.baseSpeed,
      maxHp: soldierBalance.baseMaxHp,
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
    nextEnemy: peekEnemy(rngFromSeed(DEFAULT_SEED), 0).type as EnemyType,
    soldierPipeline: { count: 0, progress: 0 },
    capacityAccumulator: 0,
    resourceRemainder: { food: 0, wood: 0, stone: 0, nectar: 0 },
    victoryAchieved: false,
    phaseGoal: null,
    decision: { open: null, nextSpawnSessionMs: null },
    lifetime: { revealsSeen: [], phasesCompleted: [] },
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
      lifetimeLpEarned: 0,
      totalFoodProduced: 0,
      totalWoodProduced: 0,
      totalStoneProduced: 0,
      totalNectarProduced: 0,
    },
    automation: initialAutomation(),
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
    research: {
      projects: {
        voidCrystalSynthesis: { status: 'idle' },
        antimatterContainment: { status: 'idle' },
        darkMatterDetection: { status: 'idle' },
        dormantForaging: { status: 'idle' },
      },
    },
    conversions: {
      particleLab: 0,
      remainder: { voidCrystalSynthesis: 0, antimatterContainment: 0, darkMatterDetection: 0 },
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
