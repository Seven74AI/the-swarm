import type { GameState } from '../state/GameState';
import { getAutoEggRate } from '../systems/AutomationSystem';

/**
 * AutoProductionLoop — per-tick auto egg generation.
 *
 * Uses the same fractional-progress pattern as the resource pipelines:
 * autoEggRate * dtSec is accumulated, floor() determines how many eggs are produced.
 * This ensures smooth production at any tick rate.
 */
export function tickAutoProduction(
  state: GameState,
  dtSec: number,
): GameState {
  if (!state.autoProduction.enabled) {
    return state;
  }

  const rate = getAutoEggRate(state);
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
    stats: {
      ...state.stats,
      totalEggsLaid: state.stats.totalEggsLaid + eggsProduced,
    },
    autoProduction: {
      ...state.autoProduction,
      progress: remaining,
    },
    totalLifetimeResources: state.totalLifetimeResources + eggsProduced,
  };
}
