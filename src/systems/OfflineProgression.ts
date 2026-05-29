import type { GameState } from '../state/GameState';
import type { TerritoryBonuses } from './TerritorySystem';
import { computeResourceRates, type ResourceRates } from './ResourceSystem';

/**
 * Offline Progression — calculates how many game ticks to simulate
 * when the player returns after being away.
 *
 * Standard incremental convention:
 * - Offline progress is capped at 8 hours
 * - Offline efficiency starts at 50% (Phase 1-4)
 * - Upgrades can increase efficiency to 75% and 100%
 *
 * Closed-form resource computation (rate × time) for deterministic
 * resources (food, wood, stone). Tick-based catch-up remains for
 * non-linear events (pipelines, battles, expeditions).
 */

export interface OfflineTickResult {
  /** Wall-clock ms actually used for catch-up (capped at 8h, floored at 0) */
  effectiveMs: number;
  /** Number of game ticks to simulate for non-linear events (efficiency-reduced) */
  offlineTicks: number;
}

/**
 * Closed-form resource deltas for the full offline period.
 * Computed once from initial state rates × total offline time.
 */
export interface OfflineResourceDeltas {
  /** Net food change (production - consumption) over the offline period. */
  foodDelta: number;
  /** Wood produced from territory bonuses over the offline period. */
  woodDelta: number;
  /** Stone produced from territory bonuses over the offline period. */
  stoneDelta: number;
  /** Nectar produced from territory bonuses over the offline period. */
  nectarDelta: number;
  /** Gross food produced (before consumption) — for prestige tracking. */
  grossFoodProduced: number;
}

/**
 * Compute closed-form resource deltas for the offline period.
 *
 * Uses the production rates from the initial game state and multiplies
 * by the total offline time. This is an approximation — worker count
 * may change during catch-up, affecting actual rates — but it provides
 * a correct order-of-magnitude result and is consistent with idle game
 * conventions (Cookie Clicker, AdVenture Capitalist, etc.).
 *
 * @param state - Initial game state at the moment of save
 * @param totalDtSec - Total offline time in seconds (effectiveMs / 1000)
 * @param territoryBonuses - Territory bonuses from the initial state
 * @returns Total resource deltas for the full offline period
 */
export function computeOfflineResourceDeltas(
  state: GameState,
  totalDtSec: number,
  territoryBonuses?: TerritoryBonuses,
): OfflineResourceDeltas {
  if (totalDtSec <= 0) {
    return { foodDelta: 0, woodDelta: 0, stoneDelta: 0, nectarDelta: 0, grossFoodProduced: 0 };
  }

  const rates = computeResourceRates(state, territoryBonuses);

  // Gross food produced (for prestige tracking — totalFoodProduced)
  const grossFoodProduced = rates.foodProducedPerSec * totalDtSec;

  // Net food = production - consumption
  const netFoodRate = rates.foodProducedPerSec - rates.foodConsumedPerSec;
  const foodDelta = netFoodRate * totalDtSec;

  return {
    foodDelta,
    woodDelta: rates.woodPerSec * totalDtSec,
    stoneDelta: rates.stonePerSec * totalDtSec,
    nectarDelta: rates.nectarPerSec * totalDtSec,
    grossFoodProduced,
  };
}

/**
 * Calculate offline ticks based on elapsed wall-clock time and efficiency.
 *
 * @param elapsedMs - Wall-clock milliseconds since last save
 * @param efficiency - Offline efficiency multiplier (0.5 = 50%, 1.0 = 100%)
 * @param tickIntervalMs - Duration of one game tick in ms (default 50)
 * @returns Object with effectiveMs (capped) and offlineTicks (efficiency-reduced)
 */
export function calculateOfflineTicks(
  elapsedMs: number,
  efficiency: number,
  tickIntervalMs: number = 50,
): OfflineTickResult {
  const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // 8 hours

  // Guard against negative elapsed (clock skew)
  if (elapsedMs <= 0) {
    return { effectiveMs: 0, offlineTicks: 0 };
  }

  const effectiveMs = Math.min(elapsedMs, OFFLINE_CAP_MS);
  const totalTicks = Math.floor(effectiveMs / tickIntervalMs);
  const offlineTicks = Math.floor(totalTicks * efficiency);

  return { effectiveMs, offlineTicks };
}
