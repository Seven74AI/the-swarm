/**
 * Worker role yields (Story 3.4, FR3, FR36): what one worker on each role
 * brings in. Read by `systems/ResourceSystem.ts` and `engine/processTick.ts`.
 * Tests import these; they never restate the numbers.
 *
 * Gather: food and wood. Forage: nectar. Tend: faster hatching. Dig: nest
 * capacity and stone. Guard: no yield (defence). An unassigned worker forages
 * food at the idle rate. Wood, stone and nectar come from these roles from
 * Colony on, so the first buildings are buyable before any territory; claimed
 * territory adds to them (TerritorySystem).
 */
export const roleBalance = {
  /** Food a gatherer brings in. */
  gatherFoodPerSec: 2,
  /** Wood a gatherer brings in (Story 3.4). */
  gatherWoodPerSec: 0.25,
  /** Nectar a forager brings in (Story 3.4). */
  forageNectarPerSec: 0.3,
  /** Food an unassigned worker forages. */
  idleFoodPerSec: 1,
  /** Each tending worker speeds hatching by this share (+25 %). */
  tendHatchBonusPerWorker: 0.25,
  /** Digging time of one dig worker per +1 nest capacity. */
  digMsPerRoom: 1_000,
  /** Stone a digger brings in (Story 3.4). */
  digStonePerSec: 0.2,
} as const;
