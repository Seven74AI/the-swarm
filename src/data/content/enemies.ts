/**
 * The enemy types (Story 4.1, FR12, UX-DR26): each with a name and one trait,
 * and each trait with the card label, the line the enemy card shows under it,
 * and the stats it changes. The trait's numbers are in
 * `data/balance/enemies.ts` (`enemyBalance.traits`), the enemy stats there too.
 * A new enemy type is a new entry here and in the balance file.
 */

export const ENEMY_TYPES = ['red_ant', 'termite', 'spider', 'beetle', 'wasp', 'scorpion'] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];

export type TraitId = 'swarm' | 'regrowth' | 'web' | 'thick_shell' | 'swift' | 'venom_resistance';

/** A stat a trait changes, named the way the fight uses it. */
export type TraitStat =
  /** How much of each soldier's strength lands. */
  | 'soldier_strength'
  /** How many soldiers strike each round. */
  | 'soldiers_striking'
  /** The enemy's hit points over the fight. */
  | 'enemy_hp'
  /** Who strikes first, and how often the enemy strikes. */
  | 'enemy_speed'
  /** Venom's damage over time. */
  | 'poison';

export interface TraitDef {
  /** Card label, upper case: `THICK SHELL`. */
  readonly label: string;
  /** The line under the title: what the trait does, in the colony's voice. */
  readonly line: string;
  readonly affects: readonly TraitStat[];
}

export const TRAITS: Readonly<Record<TraitId, TraitDef>> = {
  swarm: {
    label: 'SWARM',
    line: 'THEY COME IN NUMBERS. SHARPER WEAPONS CUT NO FASTER.',
    affects: ['soldier_strength'],
  },
  regrowth: {
    label: 'REGROWTH',
    line: 'THEIR WOUNDS CLOSE EACH ROUND. VENOM STOPS THE HEALING.',
    affects: ['enemy_hp'],
  },
  web: {
    label: 'WEB',
    line: 'WEBS HOLD THE ARMY. ONLY A FEW SOLDIERS STRIKE.',
    affects: ['soldiers_striking'],
  },
  thick_shell: {
    label: 'THICK SHELL',
    line: 'WEAK BITES GLANCE OFF. VENOM BARELY SOAKS IN.',
    affects: ['soldier_strength', 'poison'],
  },
  swift: {
    label: 'SWIFT',
    line: 'IT STRIKES FIRST, AND TWICE. ARMOR TAKES THE STINGS.',
    affects: ['enemy_speed'],
  },
  venom_resistance: {
    label: 'VENOM RESISTANCE',
    line: 'VENOM DOES LITTLE TO IT.',
    affects: ['poison'],
  },
};

export interface EnemyContent {
  readonly name: string;
  readonly trait: TraitId;
}

export const ENEMIES: Readonly<Record<EnemyType, EnemyContent>> = {
  red_ant: { name: 'Red Ant', trait: 'swarm' },
  termite: { name: 'Termite', trait: 'regrowth' },
  spider: { name: 'Spider', trait: 'web' },
  beetle: { name: 'Armored Beetle', trait: 'thick_shell' },
  wasp: { name: 'Wasp', trait: 'swift' },
  scorpion: { name: 'Scorpion', trait: 'venom_resistance' },
};

export function isEnemyType(value: unknown): value is EnemyType {
  return typeof value === 'string' && (ENEMY_TYPES as readonly string[]).includes(value);
}

/** The enemy card's title: `ARMORED BEETLE · THICK SHELL`. */
export function enemyCardTitle(type: EnemyType): string {
  const e = ENEMIES[type];
  return `${e.name.toUpperCase()} · ${TRAITS[e.trait].label}`;
}
