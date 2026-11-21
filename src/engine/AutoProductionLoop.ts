import type { GameState } from '../state/GameState';
import { getAutoEggRate } from '../systems/AutomationSystem';
import { getPrestigeBonuses } from '../systems/PrestigeBonusSystem';

/** Eggs a second laid by the prestige tree's auto egg layer. */
export const AUTO_EGG_LAYER_PER_SEC = 1;

/**
 * Eggs laid a second without a tap: automation (when enabled) plus the
 * prestige auto egg layer.
 */
export function getAutoLayRate(state: GameState): number {
  const automation = state.autoProduction.enabled ? getAutoEggRate(state) : 0;
  const layer = getPrestigeBonuses(state).autoEggLayer ? AUTO_EGG_LAYER_PER_SEC : 0;
  return automation + layer;
}

/**
 * AutoProductionLoop — per-tick auto egg generation.
 *
 * Uses the same fractional-progress pattern as the resource pipelines:
 * rate * dtSec is accumulated, floor() determines how many whole eggs are laid
 * (any step length lays the same eggs, Story 2.5). Every egg laid enters the
 * egg pipeline, so it hatches like a tapped one.
 */
export function tickAutoProduction(
  state: GameState,
  dtSec: number,
): GameState {
  const rate = getAutoLayRate(state);
  if (rate <= 0) return state;

  const progress = state.autoProduction.progress + rate * dtSec;
  const eggsProduced = Math.floor(progress);
  const remaining = progress - eggsProduced;

  if (eggsProduced <= 0) {
    return {
      ...state,
      autoProduction: {
        ...state.autoProduction,
        progress,
      },
    };
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      eggs: state.resources.eggs + eggsProduced,
    },
    eggPipeline: {
      ...state.eggPipeline,
      count: state.eggPipeline.count + eggsProduced,
    },
    stats: {
      ...state.stats,
      totalEggsLaid: state.stats.totalEggsLaid + eggsProduced,
    },
    autoProduction: {
      ...state.autoProduction,
      progress: remaining,
    },
  };
}
