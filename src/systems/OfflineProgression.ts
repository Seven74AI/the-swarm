/**
 * Offline Progression — calculates how many game ticks to simulate
 * when the player returns after being away.
 *
 * Standard incremental convention:
 * - Offline progress is capped at 8 hours
 * - Offline efficiency starts at 50% (Phase 1-4)
 * - Upgrades can increase efficiency to 75% and 100%
 */

export interface OfflineTickResult {
  /** Wall-clock ms actually used for catch-up (capped at 8h, floored at 0) */
  effectiveMs: number;
  /** Number of game ticks to simulate (efficiency-reduced) */
  offlineTicks: number;
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
