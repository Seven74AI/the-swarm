import { pick, rngStream, type RngStream } from '../utils/rng';
import type { GameState } from '../state/GameState';
import { enemyBalance } from '../data/balance/enemies';

export interface EnemyDef {
  type: string;
  name: string;
  strength: number;
  defense: number;
  speed: number;
  hp: number;
  loot: {
    foodMin: number;
    foodMax: number;
    specialResource?: { type: string; min: number; max: number };
  };
  scaling: {
    strengthPerBattle: number;
    hpPerBattle: number;
  };
}

/** Enemy names; their numbers are in `data/balance/enemies.ts`. */
const ENEMY_NAMES = {
  red_ant: 'Red Ant',
  termite: 'Termite',
  spider: 'Spider',
  beetle: 'Beetle',
  wasp: 'Wasp',
  scorpion: 'Scorpion',
} as const satisfies Record<keyof typeof enemyBalance.stats, string>;

type EnemyType = keyof typeof ENEMY_NAMES;

const ENEMY_DEFS: EnemyDef[] = (Object.keys(ENEMY_NAMES) as EnemyType[]).map((type) => {
  const b = enemyBalance.stats[type];
  return {
    type,
    name: ENEMY_NAMES[type],
    strength: b.strength,
    defense: b.defense,
    speed: b.speed,
    hp: b.hp,
    loot: { ...b.loot, ...('specialResource' in b.loot ? { specialResource: { ...b.loot.specialResource } } : {}) },
    scaling: { ...b.scaling },
  };
});

const ENEMY_MAP = new Map<string, EnemyDef>();
for (const def of ENEMY_DEFS) {
  ENEMY_MAP.set(def.type, def);
}

/** A draw table: each enemy appears as many times as its weight (`enemyBalance.weights`). */
function drawTable(weights: Readonly<Partial<Record<EnemyType, number>>>): string[] {
  return (Object.entries(weights) as [EnemyType, number][]).flatMap(([type, n]) => Array.from({ length: n }, () => type));
}

/** The draw once the scorpion is in (from `bossFromBattlesWon` battles won). */
const FULL_TABLE: string[] = drawTable(enemyBalance.weights.full);

/** The draw before the scorpion: its share spread over the others. */
const NO_BOSS_TABLE: string[] = drawTable(enemyBalance.weights.noBoss);

export function getEnemyDef(type: string): EnemyDef {
  const def = ENEMY_MAP.get(type);
  if (!def) {
    throw new Error(`Unknown enemy type: ${type}`);
  }
  return def;
}

export function getEnemyDefs(): EnemyDef[] {
  return [...ENEMY_DEFS];
}

/** A random enemy for this many battles won, drawn from `rng` (Story 3.1). */
export function getRandomEnemy(battlesWon: number, rng: RngStream): EnemyDef {
  const table = battlesWon >= enemyBalance.bossFromBattlesWon ? FULL_TABLE : NO_BOSS_TABLE;
  return getEnemyDef(pick(rng, table));
}

/**
 * The enemy the game's generator would draw next, without drawing it: the
 * enemy card shows it (Story 1.25), so the card is the same for the same save.
 */
export function peekEnemy(rngState: number, battlesWon: number): EnemyDef {
  return getRandomEnemy(battlesWon, rngStream(rngState));
}

/**
 * Scale enemy stats based on battles won using a diminishing-returns curve.
 * Uses pow(battlesWon, 0.6) instead of linear to prevent the combat scaling wall
 * where enemies outscale the soldier equipment cap (max Lv.5).
 *
 * At exponent 0.6:
 *   battle 10: pow(10, 0.6) ≈ 4.0   (similar to linear 10 with adjusted coeffs)
 *   battle 100: pow(100, 0.6) ≈ 15.8  (was 100 linear — 6x reduction)
 *   battle 500: pow(500, 0.6) ≈ 41.7  (was 500 linear — 12x reduction)
 *
 * This keeps early battles challenging while preventing late-game runaway.
 */
export function scaleEnemy(enemy: EnemyDef, battlesWon: number): EnemyDef {
  const scale = Math.pow(battlesWon, enemyBalance.scalingExponent);
  return {
    ...enemy,
    strength: enemy.strength + enemy.scaling.strengthPerBattle * scale,
    hp: enemy.hp + enemy.scaling.hpPerBattle * scale,
  };
}

/** How the army looks against an enemy, before committing (the enemy card, Story 1.25). */
export type Matchup = 'favoured' | 'even' | 'dangerous';

/**
 * A rough read of the fight, kept from the legacy scout report: soldiers times
 * weapon strength against the enemy's strength times its health. Story 4.1
 * adds traits; this stays a hint, never a promise (combat is random).
 */
export function assessMatchup(state: Pick<GameState, 'combatSoldiers' | 'equipment'>, enemy: EnemyDef): Matchup {
  const ours = state.combatSoldiers * (1 + state.equipment.weapon);
  const m = enemyBalance.matchup;
  const theirs = enemy.strength * (enemy.hp / m.hpPerThreat);
  const ratio = ours / Math.max(theirs, m.minThreat);
  if (ratio > m.favouredAbove) return 'favoured';
  if (ratio >= m.evenFrom) return 'even';
  return 'dangerous';
}
