import type { SaveData } from './SaveManager';
import type { GameState, OpenDecision, PhaseGoal } from '../state/GameState';
import { isDecisionId } from '../data/content/decisions';
import { PhaseStateMachine, reachedValues } from '../phases/PhaseStateMachine';
import { normalizeChronicle, type ChronicleSave } from '../state/chronicle';
import { isSeed, seedFrom } from '../state/seed';

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
  gameState.prestige = gameState.prestige ?? { count: 0, legacyPoints: 0, totalFoodProduced: 0, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 };

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

/** v10 → v11: adds prestigeTree permanent upgrade purchases */
function migrateV10toV11(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    prestigeTree?: { purchased: string[] };
  };

  gameState.prestigeTree = gameState.prestigeTree ?? { purchased: [] };

  return { ...data, version: 11, gameState };
}

/** v11 → v12: adds surveyData to resources (recursive exploration scaling) */
function migrateV11toV12(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    resources: { surveyData?: number };
  };

  if (gameState.resources.surveyData === undefined) {
    gameState.resources.surveyData = 0;
  }

  return { ...data, version: 12, gameState };
}

/** v12 → v13: adds colony mutations array + prestige resource tracking */
function migrateV12toV13(data: SaveData): SaveData {
  const gameState = data.gameState as GameState & {
    mutations?: { id: string; purchased: boolean }[];
    prestige: {
      totalWoodProduced?: number;
      totalStoneProduced?: number;
      totalNectarProduced?: number;
    };
  };

  // Colony mutations
  gameState.mutations = gameState.mutations ?? [];

  // Prestige resource tracking
  if (gameState.prestige.totalWoodProduced === undefined) {
    gameState.prestige.totalWoodProduced = 0;
  }
  if (gameState.prestige.totalStoneProduced === undefined) {
    gameState.prestige.totalStoneProduced = 0;
  }
  if (gameState.prestige.totalNectarProduced === undefined) {
    gameState.prestige.totalNectarProduced = 0;
  }

  return { ...data, version: 13, gameState };
}

/** Frozen at v14: game-time length of a tick and of each research project. */
const V14_TICK_MS = 50;
const V14_RESEARCH_DURATION_MS: Record<string, number> = {
  voidCrystalSynthesis: 30_000,
  antimatterContainment: 75_000,
  darkMatterDetection: 150_000,
};

type V13Timer = { ticksRemaining?: number } & Record<string, unknown>;

function v14Running(entry: V13Timer): Record<string, unknown> {
  const { ticksRemaining, ...rest } = entry;
  const remainingMs = Math.max(0, Math.floor((ticksRemaining ?? 0) * V14_TICK_MS));
  return { ...rest, status: 'running', remainingMs, durationMs: remainingMs };
}

/**
 * v13 → v14 (Story 1.6, AR23): lifecycles become discriminated unions on
 * `status` timed in game-time ms. Research `{ state, progress }` becomes
 * idle / running / done; tick timers on expeditions, explorations and probes
 * become `remainingMs`; the last battle drops its wall-clock timestamp for
 * game time (`atMs`), and `null` becomes `{ status: 'idle' }`.
 */
function migrateV13toV14(data: SaveData): SaveData {
  const gs = data.gameState as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...gs };
  const stats = gs.stats as { playTimeMs?: number } | undefined;
  const playTimeMs = stats?.playTimeMs ?? data.playTimeMs ?? 0;

  const research = gs.research as { projects?: Record<string, { state?: string; progress?: number; status?: string }> } | undefined;
  if (research?.projects) {
    const projects: Record<string, unknown> = {};
    for (const [id, p] of Object.entries(research.projects)) {
      if (p.status) {
        projects[id] = p;
      } else if (p.state === 'completed') {
        projects[id] = { status: 'done' };
      } else if (p.state === 'in_progress') {
        const durationMs = V14_RESEARCH_DURATION_MS[id] ?? 0;
        const progressMs = Math.min(durationMs, Math.floor((p.progress ?? 0) * V14_TICK_MS));
        projects[id] = { status: 'running', progressMs, durationMs };
      } else {
        projects[id] = { status: 'idle' };
      }
    }
    out.research = { ...research, projects };
  }

  for (const key of ['expeditions', 'spaceExplorations', 'spaceProbes']) {
    const list = gs[key];
    if (Array.isArray(list)) out[key] = (list as V13Timer[]).map(v14Running);
  }

  const battle = gs.lastBattle as
    | { enemyType?: string | null; result?: string; soldiersLost?: number; foodGained?: number; status?: string }
    | null
    | undefined;
  if (!battle) {
    out.lastBattle = { status: 'idle' };
  } else if (!battle.status) {
    out.lastBattle = {
      status: 'done',
      enemyType: battle.enemyType ?? 'unknown',
      result: battle.result === 'victory' || battle.result === 'defeat' ? battle.result : 'draw',
      soldiersLost: battle.soldiersLost ?? 0,
      foodGained: battle.foodGained ?? 0,
      atMs: playTimeMs,
    };
  }

  const nextIds = gs.nextIds as Record<string, number> | undefined;
  out.nextIds = { expedition: 1, exploration: 1, spaceship: 1, ...nextIds, probe: nextIds?.probe ?? 1 };

  return { ...data, version: 14, gameState: out as unknown as GameState };
}

/**
 * v14 → v15 (Story 1.19, D3): the phase goal latch. `phaseGoal` is null, or
 * latched at once when the save already meets the guard out of its phase (an
 * older save would have auto-transitioned on its next tick). The phase itself
 * never changes here: the player still taps CONTINUE.
 */
function migrateV14toV15(data: SaveData): SaveData {
  const gs = data.gameState as unknown as Record<string, unknown>;
  if (gs.phaseGoal !== undefined) return { ...data, version: 15 };
  let phaseGoal: PhaseGoal | null = null;
  try {
    const t = new PhaseStateMachine().evaluate(data.gameState);
    if (t) {
      const stats = gs.stats as { playTimeMs?: number } | undefined;
      phaseGoal = { phase: t.to, latched: true, atMs: stats?.playTimeMs ?? data.playTimeMs ?? 0, reached: reachedValues(t, data.gameState) };
    }
  } catch {
    // A partial save the guard can't read: SaveManager merges defaults in later; no latch.
  }
  return { ...data, version: 15, gameState: { ...gs, phaseGoal } as unknown as GameState };
}

/**
 * v15 → v16 (Story 1.20, UX-DR27): `lifetime.revealsSeen`, the phases whose
 * reveal has been seen. Older saves start empty: each reveal plays once
 * unskippable, as it would have for a new player.
 */
function migrateV15toV16(data: SaveData): SaveData {
  const gs = data.gameState as unknown as Record<string, unknown>;
  const lifetime = gs.lifetime as { revealsSeen?: unknown } | undefined;
  const seen = Array.isArray(lifetime?.revealsSeen)
    ? (lifetime.revealsSeen as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];
  return { ...data, version: 16, gameState: { ...gs, lifetime: { ...lifetime, revealsSeen: seen } } as unknown as GameState };
}

/** Frozen at v17: phases in game order, for the milestones a save has passed. */
const V17_PHASES = ['egg_laying', 'colony', 'combat', 'expansion', 'space', 'transcendence'];
/** Frozen at v17: panels whose reveal writes a one-time line, and the phase that reveals them. */
const V17_PANEL_LINES: ReadonlyArray<readonly [string, string]> = [
  ['soldier_panel', 'combat'],
  ['building_panel', 'expansion'],
  ['expedition_panel', 'expansion'],
  ['spaceship_panel', 'space'],
];

/**
 * v16 → v17 (Story 1.26, UX-DR30): the chronicle (event lines, newest first,
 * last 100) goes into the save, beside the game state (ADR 0018). Older saves
 * had none: they start with no lines, and their one-time lines (first egg,
 * first worker, phase lines, "now available" lines, …) are marked as passed from the game state, so
 * a "first egg" line never turns up deep into a run.
 */
function migrateV16toV17(data: SaveData): SaveData {
  if (data.chronicle !== undefined) return { ...data, version: 17, chronicle: normalizeChronicle(data.chronicle) };
  const gs = data.gameState as unknown as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const obj = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});
  const stats = obj(gs.stats);
  const resources = obj(gs.resources);
  const equipment = obj(gs.equipment);
  const phaseRank = Math.max(0, V17_PHASES.indexOf(typeof gs.phase === 'string' ? gs.phase : ''));
  const milestones: string[] = [];
  const mark = (id: string, passed: boolean) => {
    if (passed) milestones.push(id);
  };
  mark('first_egg', num(stats.totalClicks) > 0 || num(stats.totalEggsLaid) > 0);
  mark('first_worker', num(resources.workers) > 0 || phaseRank >= 1);
  mark('tenth_worker', num(resources.workers) >= 10);
  mark('first_soldier', num(gs.combatSoldiers) > 0);
  mark('first_weapon', num(equipment.weapon) > 0);
  mark('first_armor', num(equipment.armor) > 0);
  for (const phase of V17_PHASES.slice(1)) mark(`phase_${phase}`, phaseRank >= V17_PHASES.indexOf(phase));
  // "Now available" lines for panels the save's phase has already revealed.
  for (const [panel, phase] of V17_PANEL_LINES) mark(`panel_${panel}`, phaseRank >= V17_PHASES.indexOf(phase));
  const chronicle: ChronicleSave = { entries: [], milestones };
  return { ...data, version: 17, chronicle };
}

/** A saved open decision event, or null if it is missing or malformed. */
function normalizeOpenDecision(raw: unknown): OpenDecision | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!isDecisionId(r.id)) return null;
  if (r.remainingMs !== null && !finite(r.remainingMs)) return null;
  if (!finite(r.openedAtSessionMs) || !finite(r.roll)) return null;
  return {
    id: r.id,
    remainingMs: r.remainingMs === null ? null : Math.max(0, Math.floor(r.remainingMs as number)),
    openedAtSessionMs: Math.floor(r.openedAtSessionMs),
    roll: Math.min(1, Math.max(0, r.roll)),
  };
}

/**
 * v17 → v18 (Story 1.28, D8, N3): the open decision event goes into the save
 * with its remaining time, so closing the app is no escape. Older saves had
 * none open (events lived only in the UI). A malformed slot is dropped. The
 * spawn time is per session, so it is never carried over.
 */
function migrateV17toV18(data: SaveData): SaveData {
  const gs = data.gameState as unknown as Record<string, unknown>;
  const raw = gs.decision !== null && typeof gs.decision === 'object' ? (gs.decision as Record<string, unknown>) : {};
  const decision = { open: normalizeOpenDecision(raw.open), nextSpawnSessionMs: null };
  return { ...data, version: 18, gameState: { ...gs, decision } as unknown as GameState };
}

/**
 * v18 → v19 (Story 1.34, D6): the save holds the game's seed. A save without a
 * valid one gets a seed derived from its own timestamp: stable for that save,
 * different between saves. Story 3.1 seeds the generator from it.
 */
function migrateV18toV19(data: SaveData): SaveData {
  const gs = data.gameState as unknown as Record<string, unknown>;
  const seed = isSeed(gs.seed) ? gs.seed : seedFrom(typeof data.timestamp === 'number' ? data.timestamp : 0);
  return { ...data, version: 19, gameState: { ...gs, seed } as unknown as GameState };
}

/**
 * v19 → v20 (Story 2.3, D1): the save says when its state was last simulated
 * to (`lastSeenAt`), so the resume path never measures the gap from a save
 * written while the page was hidden. Older saves were always written while
 * running, so their save time is that moment.
 */
function migrateV19toV20(data: SaveData): SaveData {
  const gs = data.gameState as unknown as Record<string, unknown>;
  const fromState = typeof gs.lastSaveTimestamp === 'number' && gs.lastSaveTimestamp > 0 ? gs.lastSaveTimestamp : 0;
  const lastSeenAt = fromState || (typeof data.timestamp === 'number' ? data.timestamp : 0);
  return { ...data, version: 20, lastSeenAt };
}

/**
 * v20 → v21 (Story 2.5, AR4/AR20): rate-credited resources (food, wood, stone,
 * nectar) are whole numbers, their fractions carried in `resourceRemainder`;
 * each conversion carries its progress toward the next run in
 * `conversions.remainder`. An older save's fractional stock is split into
 * the whole part and its carry, so nothing is lost.
 */
const V21_CREDITED = ['food', 'wood', 'stone', 'nectar'] as const;
function migrateV20toV21(data: SaveData): SaveData {
  const gs = data.gameState as unknown as Record<string, unknown>;
  const resources = { ...((gs.resources ?? {}) as Record<string, unknown>) };
  const resourceRemainder: Record<string, number> = {};
  for (const key of V21_CREDITED) {
    const raw = resources[key];
    const value = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
    const whole = Math.floor(value);
    if (typeof raw === 'number') resources[key] = whole;
    resourceRemainder[key] = value - whole;
  }
  const conversions = { ...((gs.conversions ?? {}) as Record<string, unknown>) };
  conversions.remainder = { voidCrystalSynthesis: 0, antimatterContainment: 0, darkMatterDetection: 0 };
  return {
    ...data,
    version: 21,
    gameState: { ...gs, resources, resourceRemainder, conversions } as unknown as GameState,
  };
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
  10: migrateV10toV11,
  11: migrateV11toV12,
  12: migrateV12toV13,
  13: migrateV13toV14,
  14: migrateV14toV15,
  15: migrateV15toV16,
  16: migrateV16toV17,
  17: migrateV17toV18,
  18: migrateV18toV19,
  19: migrateV19toV20,
  20: migrateV20toV21,
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
