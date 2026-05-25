import type { GameState } from '../state/GameState';
import { PRESTIGE_UPGRADES, type PrestigeUpgradeEffect } from '../data/prestigeTree';

/**
 * Per-purchase bonus values for production upgrades.
 * Used in additive stacking: 1 + bonus * purchasedCount.
 */
export const PRODUCTION_BONUS_VALUES: Record<string, number> = {
  egg_laying: 0.25,
  hatching: 0.25,
  food: 0.25,
  soldier_training: 0.25,
  worker_efficiency: 0.10,
};

/**
 * The computed set of active prestige bonuses for the current game state.
 * Calculated once per tick from the purchased prestige tree upgrades.
 */
export interface PrestigeBonuses {
  /** Multiplier for egg pipeline hatch rate */
  eggLaying: number;
  /** Multiplier for larva pipeline mature rate */
  hatching: number;
  /** Multiplier for food production (applied to foodProduced before floor) */
  food: number;
  /** Multiplier for soldier training rate */
  soldierTraining: number;
  /** Multiplier for worker efficiency (combined with workerEfficiency soft cap) */
  workerEfficiency: number;
  /** Whether auto-egg-laying is active (1 egg/sec into eggPipeline) */
  autoEggLayer: boolean;
  /** Whether starting resources bonus is active (50 eggs + 25 food on init) */
  startingResources: boolean;
  /** Whether phase skip is active (start at Phase 2) */
  phaseSkip: boolean;
}

/** Neutral bonuses — returned when no upgrades are purchased. */
const NEUTRAL_BONUSES: PrestigeBonuses = {
  eggLaying: 1.0,
  hatching: 1.0,
  food: 1.0,
  soldierTraining: 1.0,
  workerEfficiency: 1.0,
  autoEggLayer: false,
  startingResources: false,
  phaseSkip: false,
};

/**
 * Count how many times a specific upgrade effect has been purchased.
 */
function countPurchased(
  purchased: string[],
  effect: PrestigeUpgradeEffect,
): number {
  let count = 0;
  for (const id of purchased) {
    const upgrade = PRESTIGE_UPGRADES.find((u) => u.id === id);
    if (upgrade && upgrade.effect === effect) {
      count++;
    }
  }
  return count;
}

/**
 * Check if any upgrade with the given effect has been purchased.
 */
function hasEffect(
  purchased: string[],
  effect: PrestigeUpgradeEffect,
): boolean {
  return purchased.some((id) => {
    const upgrade = PRESTIGE_UPGRADES.find((u) => u.id === id);
    return upgrade?.effect === effect;
  });
}

/**
 * Compute all active prestige bonuses from the purchased upgrade list.
 *
 * Production bonuses stack additively within the same upgrade type:
 *   multiplier = 1 + bonusValue * purchasedCount
 *
 * Bonuses from different upgrade types multiply (applied independently):
 *   eggLaying 1.50 × workerEfficiency 1.20 = cumulative effect
 */
export function getPrestigeBonuses(state: GameState): PrestigeBonuses {
  const purchased = state.prestigeTree?.purchased ?? [];

  if (purchased.length === 0) {
    return { ...NEUTRAL_BONUSES };
  }

  return {
    eggLaying: 1 + PRODUCTION_BONUS_VALUES.egg_laying * countPurchased(purchased, 'egg_laying'),
    hatching: 1 + PRODUCTION_BONUS_VALUES.hatching * countPurchased(purchased, 'hatching'),
    food: 1 + PRODUCTION_BONUS_VALUES.food * countPurchased(purchased, 'food'),
    soldierTraining: 1 + PRODUCTION_BONUS_VALUES.soldier_training * countPurchased(purchased, 'soldier_training'),
    workerEfficiency: 1 + PRODUCTION_BONUS_VALUES.worker_efficiency * countPurchased(purchased, 'worker_efficiency'),
    autoEggLayer: hasEffect(purchased, 'auto_egg_laying'),
    startingResources: hasEffect(purchased, 'starting_resources'),
    phaseSkip: hasEffect(purchased, 'phase_skip'),
  };
}

/**
 * Check if a specific prestige upgrade ID has been purchased.
 */
export function hasPurchased(state: GameState, upgradeId: string): boolean {
  return state.prestigeTree?.purchased?.includes(upgradeId) ?? false;
}
