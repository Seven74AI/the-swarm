/**
 * Worker role yields (Story 3.4, FR3, FR36): what one worker on each role
 * brings in. Read by `systems/ResourceSystem.ts` and `engine/processTick.ts`.
 * Tests import these; they never restate the numbers.
 *
 * Gather: food and wood. Forage: nectar. Tend: faster hatching. Dig: adds to
 * every DIG press, digs slowly alone (`data/balance/dig.ts`, Story 9.2) and
 * brings in stone. Guard: no yield (defence). An unassigned worker forages
 * food at the idle rate. Wood, stone and nectar come from these roles from
 * Colony on, so the first buildings are buyable before any territory; claimed
 * territory adds to them (TerritorySystem).
 *
 * Story 3.11 tuned the basic-resource yields and digging to the GDD's
 * Difficulty Curve: an offline gap of a few hours, not a few seconds, buys
 * the next building, and the nest grows mostly through the Warehouse.
 */
export const roleBalance = {
  /** Food a gatherer brings in. */
  gatherFoodPerSec: 2,
  /** Wood a gatherer brings in (Story 3.4). */
  gatherWoodPerSec: 0.01,
  /** Nectar a forager brings in (Story 3.4). */
  forageNectarPerSec: 0.01,
  /** Food an unassigned worker forages. */
  idleFoodPerSec: 1,
  /** Each tending worker speeds hatching by this share (+25 %). */
  tendHatchBonusPerWorker: 0.25,
  /** Stone a digger brings in (Story 3.4). */
  digStonePerSec: 0.01,
} as const;
