import { resourceBalance } from './resources';

/**
 * The food upgrades (Story 4.6, FR19): Click Power and the egg-chamber
 * upgrades Phase 1 sells beside it. Each level costs
 * `floor(baseCost × costMultiplier^level)` food and adds `perLevel` of each
 * effect. Effects are data so a test can compare any two items
 * (`systems/NextAction.ts` `itemEffects`): none may cost the same or less
 * and give at least as much of every effect as another.
 *
 * Read by `systems/ResourceSystem.ts`. Tests import these; they never
 * restate the numbers.
 */
export interface UpgradeEffects {
  /** Extra eggs per tap (Click Power only: it stays the one tap upgrade). */
  readonly eggsPerTap?: number;
  /** Percent added to the hatch rate (eggs → larvae). */
  readonly hatchPercent?: number;
  /** Percent taken off each worker's food upkeep. */
  readonly upkeepCutPercent?: number;
  /** Nest rooms added. */
  readonly nestCapacity?: number;
}

export interface UpgradeBalance {
  readonly baseCost: number;
  readonly costMultiplier: number;
  /** The last level sold; none for Click Power. */
  readonly maxLevel?: number;
  readonly perLevel: UpgradeEffects;
}

export type UpgradeId = 'click_power' | 'warm_brood' | 'lean_rations' | 'side_chamber';

/** The egg-chamber upgrades, sold only in Egg Laying (Story 4.6), in the order NEST shows them. */
export const NEST_UPGRADE_IDS = ['warm_brood', 'lean_rations', 'side_chamber'] as const satisfies readonly UpgradeId[];

export const upgradeBalance: Readonly<Record<UpgradeId, UpgradeBalance>> = {
  click_power: { ...resourceBalance.clickPower, perLevel: { eggsPerTap: resourceBalance.eggsPerTapPerLevel } },
  // Hatching: the brood already laid turns into larvae sooner. Pillar 1 (the pipeline), Pillar 3 (spend, not tap).
  warm_brood: { baseCost: 20, costMultiplier: 1.5, maxLevel: 3, perLevel: { hatchPercent: 15 } },
  // Upkeep: workers eat less, so food comes in faster. Pillar 4: the cut is capped, upkeep always bites.
  lean_rations: { baseCost: 25, costMultiplier: 2.2, maxLevel: 3, perLevel: { upkeepCutPercent: 15 } },
  // Capacity: more rooms for the workers to come. Pillar 1 (bounded by capacity); no help before the nest fills.
  side_chamber: { baseCost: 30, costMultiplier: 1.5, maxLevel: 2, perLevel: { nestCapacity: 2 } },
};
