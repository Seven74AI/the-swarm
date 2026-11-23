/**
 * The nest's balance (Story 3.2, FR40): laying, hatching, maturing, upkeep
 * and Click Power (the role yields are in `roles.ts`, Story 3.4). Read by `systems/ResourceSystem.ts`,
 * `engine/processTick.ts` and `engine/AutoProductionLoop.ts`. Tests import
 * these; they never restate the numbers.
 *
 * Conversions from the old tick-named constants (20 Hz, TICK_MS = 50), with no
 * change to pacing:
 * - `EGG_HATCH_TIME = 50` and `LARVA_MATURE_TIME = 50` were labelled "ticks",
 *   but the pipelines divided the step's SECONDS by them (k = 1/50 per
 *   second), so an egg took 50 s on average, not 50 × 50 ms. Kept as 50 000 ms.
 * - `DIG_TICKS_PER_ROOM = 20` counted real 50 ms ticks: 20 × 50 ms = 1 000 ms
 *   of one dig worker per room (Story 9.2 replaced it with `data/balance/dig.ts`).
 *
 * Story 3.11 tuned these to the GDD's Difficulty Curve (the before and after
 * `pnpm sim` reports are in its story file): an egg now takes about 15 min to
 * hatch and a larva 15 min to mature, so Phase 1 is minutes of tapping, not
 * seconds, and eggs laid in a check-in become workers while the player is away.
 */
export const resourceBalance = {
  /** Mean time an egg takes to hatch (pipeline rate k = 1 / hatchMs). */
  hatchMs: 600_000,
  /** Mean time a larva takes to mature into a worker. */
  matureMs: 600_000,
  /** Food each worker eats. */
  upkeepFoodPerSec: 0.5,
  /** Eggs one tap lays at Click Power 0 (FR1). */
  eggsPerTap: 1,
  /** Extra eggs per tap for each Click Power level (FR1). */
  eggsPerTapPerLevel: 1,
  /** Click Power's food cost: `floor(baseCost × costMultiplier^level)`. */
  clickPower: { baseCost: 10, costMultiplier: 1.15 },
  /** Eggs the Legacy auto egg layer lays. */
  autoEggLayerPerSec: 1,
} as const;
