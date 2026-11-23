import type { GameState } from '../state/GameState';
import type { RefusalReason } from '../actions/result';
import { Phase } from '../phases/phases';
import { feedBalance } from '../data/balance/feed';
import { getEffects } from './BuildingSystem';

/**
 * FEED (Story 9.4, FR57, FR2): from Colony on a tap on the brood matures up
 * to `feedBalance.larvaePerFeed` waiting larvae at once, never more than the
 * free rooms. Free of cost. Pure functions.
 */

/** Room for more workers: the effective nest capacity (Warehouse included) minus the workers. */
export function freeRooms(s: GameState): number {
  const cap = s.resources.nestCapacity + (getEffects('warehouse', s.buildings.warehouse.level).nestCapacity ?? 0);
  return Math.max(0, Math.floor(cap - s.resources.workers));
}

/** Why FEED can't run now (Egg Laying, a full nest, no larvae waiting), or null. */
export function feedRefusal(s: GameState): Extract<RefusalReason, 'locked' | 'at_capacity' | 'unavailable'> | null {
  if (s.phase === Phase.EGG_LAYING) return 'locked';
  if (freeRooms(s) <= 0) return 'at_capacity';
  if (Math.min(s.resources.larvae, s.larvaPipeline.count) <= 0) return 'unavailable';
  return null;
}

/**
 * One FEED: larvae leave the larva pipeline and become workers, each one
 * (the pipeline rule), in whole numbers. Returns the state unchanged when
 * `feedRefusal` says no.
 */
export function feedBrood(s: GameState): GameState {
  if (feedRefusal(s) !== null) return s;
  const n = Math.min(feedBalance.larvaePerFeed, freeRooms(s), Math.floor(s.resources.larvae), Math.floor(s.larvaPipeline.count));
  return {
    ...s,
    resources: { ...s.resources, larvae: s.resources.larvae - n, workers: s.resources.workers + n },
    larvaPipeline: { ...s.larvaPipeline, count: s.larvaPipeline.count - n },
  };
}
