import type { TraitId } from '../content/enemies';

/**
 * What an upgrade counters (Story 4.2): strong against these traits, weak
 * (no bonus, or a weaker one) against those. `tests/sim/counters.test.ts`
 * checks every mark against the real fight.
 */
export interface CounterMarks {
  readonly strongAgainst: readonly TraitId[];
  readonly weakAgainst: readonly TraitId[];
}

/**
 * Battle balance (Story 3.2): rounds, damage and loss rolls, poison and the
 * scorpion's chitin, and how enemies scale with battles won. Read by `systems/BattleSystem.ts` and
 * `systems/VenomSystem.ts`. Enemy stats and scaling are in `enemies.ts`.
 */
export const combatBalance = {
  /**
   * Enemy strength and hit points grow with `battlesWon ^ enemyScalingExponent`:
   * below 1, so the growth slows and equipment (max Lv.5) keeps up (Story 4.1).
   */
  enemyScalingExponent: 0.6,
  /** A battle ends after this many rounds at most. */
  maxRounds: 20,
  /** Each hit is the attack ratio × a roll in [min, max). */
  damageRoll: { min: 0.85, max: 1.15 },
  /** Soldiers lost in a won battle: enemy strength / defence × a roll in [min, max). */
  lossRoll: { min: 0.7, max: 1.3 },
  /** Defence never counts below this in the loss roll. */
  minDefense: 0.1,
  /** Extra chitin a scorpion drops, a whole number in [min, max]. */
  scorpionChitin: { min: 1, max: 5 },
  /** Poison damage per battle round for each Venom Lab level. */
  poisonDamagePerLabLevel: 2,
  /** Venom one battle with poison uses. */
  venomPerBattle: 1,
  /**
   * Equipment (Story 4.2, FR9): what each level adds (level 1 first) and what
   * it counters. Weapons add strength (cut by a swarm's cap, kept by a shell,
   * the first levels outpace regrowth);
   * armor adds defence and hit points (the stings of a swift enemy, nothing
   * against a shell the army cannot crack in time).
   */
  equipment: {
    weapon: [
      { strength: 1, strongAgainst: ['thick_shell', 'regrowth', 'web'], weakAgainst: ['swarm', 'swift'] },
      { strength: 1, strongAgainst: ['thick_shell', 'regrowth'], weakAgainst: ['swarm'] },
      { strength: 1, strongAgainst: ['thick_shell'], weakAgainst: ['swarm'] },
      { strength: 1, strongAgainst: ['thick_shell'], weakAgainst: ['swarm'] },
      { strength: 1, strongAgainst: ['thick_shell'], weakAgainst: ['swarm'] },
    ],
    armor: [
      { defense: 1, maxHp: 2, strongAgainst: ['swift', 'web', 'venom_resistance'], weakAgainst: ['thick_shell', 'regrowth'] },
      { defense: 1, maxHp: 2, strongAgainst: ['swift'], weakAgainst: ['thick_shell', 'regrowth'] },
      { defense: 1, maxHp: 2, strongAgainst: ['swift'], weakAgainst: ['thick_shell', 'regrowth'] },
      { defense: 1, maxHp: 2, strongAgainst: ['swift'], weakAgainst: ['thick_shell', 'regrowth'] },
      { defense: 1, maxHp: 2, strongAgainst: ['swift'], weakAgainst: ['thick_shell', 'regrowth'] },
    ],
  },
  /**
   * The mutations in battle (Story 4.2, FR10): what each adds to the fight
   * and what it counters. Costs and the colony effects (gathering, hatching)
   * are in `mutations.ts`.
   * - `webStrikers`: soldiers who strike past a web's limit.
   * - `healPerRound`: hit points the army recovers at each round's end.
   * - `firstStrike`: the army strikes before any enemy, a swift one included.
   * - `poisonDamage`: a share added to venom's damage (0.5 = +50 %).
   */
  mutations: {
    efficient_gatherers: { fight: { webStrikers: 4 }, strongAgainst: ['web'], weakAgainst: ['swarm', 'thick_shell'] },
    swift_soldiers: { fight: { speed: 1, firstStrike: 1 }, strongAgainst: ['swift'], weakAgainst: ['regrowth', 'thick_shell'] },
    accelerated_hatching: { fight: { healPerRound: 2 }, strongAgainst: ['swarm'], weakAgainst: ['swift'] },
    tough_shells: { fight: { maxHp: 2 }, strongAgainst: ['swift'], weakAgainst: ['thick_shell', 'regrowth'] },
    potent_venom: { fight: { poisonDamage: 0.5 }, strongAgainst: ['regrowth'], weakAgainst: ['venom_resistance', 'thick_shell'] },
    reinforced_mandibles: { fight: { strength: 1 }, strongAgainst: ['thick_shell'], weakAgainst: ['swift'] },
  },
} as const;
