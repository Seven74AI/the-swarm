/**
 * Combat soldiers' balance (Story 3.2, FR40): the training cost and time,
 * equipment and the soldier's base stats. Read by `systems/SoldierSystem.ts`.
 * Tests import these; they never restate the numbers.
 *
 * Conversion: `SOLDIER_TRAIN_TIME = 75` divided the step's SECONDS (k = 1/75
 * per second), so a soldier trained in 75 s on average. Kept as 75 000 ms.
 */
export const soldierBalance = {
  /** Food to start training one soldier (it also takes one free worker). */
  costFood: 5,
  /** Mean training time (pipeline rate k = 1 / trainMs). */
  trainMs: 75_000,
  /** Weapon and armour stop at this level (one entry per level in `combatBalance.equipment`). */
  maxEquipmentLevel: 5,
  /** Chitin (weapon) or silk (armour) per upgrade: `floor(baseCost × costMultiplier^level)`. */
  equipmentUpgrade: { baseCost: 10, costMultiplier: 1.2 },
  /** Strength, defence, speed and max HP at equipment level 0; each level's gain is in `combat.ts` (`equipment`). */
  baseStrength: 1,
  baseDefense: 1,
  baseSpeed: 5,
  baseMaxHp: 10,
} as const;
