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
} as const;
