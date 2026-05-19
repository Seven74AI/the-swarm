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

const ENEMY_DEFS: EnemyDef[] = [
  {
    type: 'red_ant',
    name: 'Red Ant',
    strength: 3,
    defense: 1,
    speed: 10,
    hp: 15,
    loot: { foodMin: 5, foodMax: 10 },
    scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
  },
  {
    type: 'termite',
    name: 'Termite',
    strength: 5,
    defense: 4,
    speed: 4,
    hp: 25,
    loot: { foodMin: 10, foodMax: 20 },
    scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
  },
  {
    type: 'spider',
    name: 'Spider',
    strength: 12,
    defense: 2,
    speed: 8,
    hp: 30,
    loot: {
      foodMin: 25,
      foodMax: 40,
      specialResource: { type: 'silk', min: 1, max: 3 },
    },
    scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
  },
  {
    type: 'beetle',
    name: 'Beetle',
    strength: 8,
    defense: 8,
    speed: 2,
    hp: 50,
    loot: {
      foodMin: 30,
      foodMax: 50,
      specialResource: { type: 'chitin', min: 1, max: 3 },
    },
    scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
  },
  {
    type: 'wasp',
    name: 'Wasp',
    strength: 15,
    defense: 3,
    speed: 12,
    hp: 20,
    loot: {
      foodMin: 20,
      foodMax: 35,
      specialResource: { type: 'venom', min: 1, max: 3 },
    },
    scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
  },
  {
    type: 'scorpion',
    name: 'Scorpion',
    strength: 20,
    defense: 6,
    speed: 5,
    hp: 80,
    loot: {
      foodMin: 60,
      foodMax: 100,
      specialResource: { type: 'venom', min: 3, max: 8 },
    },
    scaling: { strengthPerBattle: 1, hpPerBattle: 5 },
  },
];

const ENEMY_MAP = new Map<string, EnemyDef>();
for (const def of ENEMY_DEFS) {
  ENEMY_MAP.set(def.type, def);
}

/**
 * Weighted table for getRandomEnemy when battlesWon >= 5 (scorpion unlocked).
 * Weights: red_ant=40, termite=25, spider=15, beetle=10, wasp=7, scorpion=3
 */
const FULL_TABLE: string[] = [];
for (let i = 0; i < 40; i++) FULL_TABLE.push('red_ant');
for (let i = 0; i < 25; i++) FULL_TABLE.push('termite');
for (let i = 0; i < 15; i++) FULL_TABLE.push('spider');
for (let i = 0; i < 10; i++) FULL_TABLE.push('beetle');
for (let i = 0; i < 7; i++) FULL_TABLE.push('wasp');
for (let i = 0; i < 3; i++) FULL_TABLE.push('scorpion');

/**
 * Weighted table for getRandomEnemy when battlesWon < 5 (scorpion locked).
 * Redistribute scorpion's 3% proportionally: red_ant=40→41.24(≈41), termite=25→25.77(≈26),
 * spider=15→15.46(≈16), beetle=10→10.31(≈10), wasp=7→7.22(≈7)
 */
const NO_BOSS_TABLE: string[] = [];
for (let i = 0; i < 41; i++) NO_BOSS_TABLE.push('red_ant');
for (let i = 0; i < 26; i++) NO_BOSS_TABLE.push('termite');
for (let i = 0; i < 16; i++) NO_BOSS_TABLE.push('spider');
for (let i = 0; i < 10; i++) NO_BOSS_TABLE.push('beetle');
for (let i = 0; i < 7; i++) NO_BOSS_TABLE.push('wasp');

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

export function getRandomEnemy(battlesWon: number): EnemyDef {
  const table = battlesWon >= 5 ? FULL_TABLE : NO_BOSS_TABLE;
  const idx = Math.floor(Math.random() * table.length);
  const type = table[idx];
  return getEnemyDef(type);
}

export function scaleEnemy(enemy: EnemyDef, battlesWon: number): EnemyDef {
  return {
    ...enemy,
    strength: enemy.strength + enemy.scaling.strengthPerBattle * battlesWon,
    hp: enemy.hp + enemy.scaling.hpPerBattle * battlesWon,
  };
}
