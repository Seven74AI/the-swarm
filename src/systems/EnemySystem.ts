import { pick, rngStream, type RngStream } from '../utils/rng';
import { enemyBalance } from '../data/balance/enemies';
import { combatBalance } from '../data/balance/combat';
import { ENEMIES, ENEMY_TYPES, type EnemyType, type TraitId } from '../data/content/enemies';

export interface EnemyDef {
  type: string;
  name: string;
  /** Its trait (Story 4.1): what it is strong against, shown on the enemy card. */
  trait: TraitId;
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

/** What a trait changes in the fight (`enemyBalance.traits`; each field is described there). */
export interface TraitEffects {
  readonly hitCap?: number;
  readonly shell?: number;
  readonly glanceShare?: number;
  readonly poisonShare?: number;
  readonly strikersMax?: number;
  readonly strikesPerRound?: number;
  readonly strikesFirst?: boolean;
  readonly regrowthPerRound?: number;
}

export function traitEffects(trait: TraitId): TraitEffects {
  return enemyBalance.traits[trait];
}

const ENEMY_DEFS: EnemyDef[] = ENEMY_TYPES.map((type) => {
  const b = enemyBalance.stats[type];
  return {
    type,
    name: ENEMIES[type].name,
    trait: ENEMIES[type].trait,
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
 * Uses pow(battlesWon, combatBalance.enemyScalingExponent) instead of linear to prevent the combat scaling wall
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
  const scale = Math.pow(battlesWon, combatBalance.enemyScalingExponent);
  return {
    ...enemy,
    strength: enemy.strength + enemy.scaling.strengthPerBattle * scale,
    hp: enemy.hp + enemy.scaling.hpPerBattle * scale,
  };
}
