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
  /** Weapon and armour stop at this level. */
  maxEquipmentLevel: 5,
  /** Chitin (weapon) or silk (armour) per upgrade: `floor(baseCost × costMultiplier^level)`. */
  equipmentUpgrade: { baseCost: 10, costMultiplier: 1.2 },
  /** Strength at weapon level 0; each weapon level adds `strengthPerWeaponLevel`. */
  baseStrength: 1,
  strengthPerWeaponLevel: 1,
  /** Defence at armour level 0; each armour level adds `defensePerArmorLevel`. */
  baseDefense: 1,
  defensePerArmorLevel: 1,
  baseSpeed: 5,
  /** Max HP at armour level 0; each armour level adds `maxHpPerArmorLevel`. */
  baseMaxHp: 10,
  maxHpPerArmorLevel: 2,
} as const;
