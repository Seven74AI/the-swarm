/**
 * Enemy balance (Story 3.2): base stats, loot, scaling with battles won, the
 * draw weights and the matchup hint. Read by `systems/EnemySystem.ts`; names
 * stay there. Tests import these; they never restate the numbers.
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
  /** Enemy stats grow with `battlesWon ^ scalingExponent` (diminishing, so equipment keeps up). */
  scalingExponent: 0.6,
  /** The enemy card's hint: soldiers × (1 + weapon) against strength × hp / hpPerThreat. */
  matchup: { hpPerThreat: 10, minThreat: 0.1, favouredAbove: 1.5, evenFrom: 0.8 },
} as const;
