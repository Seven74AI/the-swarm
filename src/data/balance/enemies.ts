/**
 * Enemy balance (Story 3.2): base stats, loot, scaling with battles won, the
 * draw weights, the trait numbers and the matchup hint. Read by
 * `systems/EnemySystem.ts`; names and traits are in `data/content/enemies.ts`.
 * Tests import these; they never restate the numbers.
 */
export const enemyBalance = {
  stats: {
    red_ant: {
      strength: 3, defense: 1, speed: 10, hp: 15,
      loot: { foodMin: 5, foodMax: 10 },
      scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
    },
    termite: {
      strength: 5, defense: 4, speed: 4, hp: 25,
      loot: { foodMin: 10, foodMax: 20 },
      scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
    },
    spider: {
      strength: 12, defense: 2, speed: 8, hp: 30,
      loot: { foodMin: 25, foodMax: 40, specialResource: { type: 'silk', min: 1, max: 3 } },
      scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
    },
    beetle: {
      strength: 8, defense: 8, speed: 2, hp: 50,
      loot: { foodMin: 30, foodMax: 50, specialResource: { type: 'chitin', min: 1, max: 3 } },
      scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
    },
    wasp: {
      strength: 15, defense: 3, speed: 12, hp: 20,
      loot: { foodMin: 20, foodMax: 35, specialResource: { type: 'venom', min: 1, max: 3 } },
      scaling: { strengthPerBattle: 0.5, hpPerBattle: 2 },
    },
    scorpion: {
      strength: 20, defense: 6, speed: 5, hp: 80,
      loot: { foodMin: 60, foodMax: 100, specialResource: { type: 'venom', min: 3, max: 8 } },
      scaling: { strengthPerBattle: 1, hpPerBattle: 5 },
    },
  },
  /** The scorpion joins the draw from this many battles won. */
  bossFromBattlesWon: 5,
  /** Draw weights (entries in the draw table) with the scorpion, and before it. */
  weights: {
    full: { red_ant: 40, termite: 25, spider: 15, beetle: 10, wasp: 7, scorpion: 3 },
    noBoss: { red_ant: 41, termite: 26, spider: 16, beetle: 10, wasp: 7 },
  },
  /**
   * Trait numbers (Story 4.1; names, lines and affected stats are in
   * `data/content/enemies.ts`). Every field is optional in the fight:
   * - `hitCap`: each soldier's strength lands up to this much per hit.
   * - `shell`: each soldier's hit loses this much strength, but never below
   *   `glanceShare` of it.
   * - `poisonShare`: the share of venom damage that lands.
   * - `strikersMax`: at most this many soldiers strike each round.
   * - `strikesPerRound` / `strikesFirst`: the enemy strikes this often, and
   *   before the soldiers whatever their speed.
   * - `regrowthPerRound`: hit points the enemy heals at each round's end,
   *   unless venom hit it that round.
   */
  traits: {
    swarm: { hitCap: 2 },
    regrowth: { regrowthPerRound: 2 },
    web: { strikersMax: 8 },
    thick_shell: { shell: 1, glanceShare: 0.5, poisonShare: 0.25 },
    swift: { strikesPerRound: 2, strikesFirst: true },
    venom_resistance: { poisonShare: 0.25 },
  },
  /**
   * The enemy card's hint: the fight played out once with every roll at
   * `roll`. Not a win: dangerous. A win with at least `favouredHpShare` of the
   * army's hit points left: favoured. Otherwise even.
   */
  matchup: { roll: 0.5, favouredHpShare: 0.5 },
} as const;
