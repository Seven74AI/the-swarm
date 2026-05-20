/**
 * ProgressionCurve — Mathematical pacing curves for THE SWARM.
 *
 * All pure functions for progression math:
 * - productionMultiplier: phase-based + legacy-points production scaling
 * - softCapEffectiveness: diminishing returns on building levels
 * - workerEfficiency: diminishing returns on worker count
 * - buildingUpgradeCost: exponential cost scaling for building upgrades
 * - getPhaseNumber: phase name → numeric index mapping
 */

/** Maps phase names to their numeric position (egg_laying=1, …, transcendence=6). */
const PHASE_NUMBER: Record<string, number> = {
  egg_laying: 1,
  colony: 2,
  combat: 3,
  expansion: 4,
  space: 5,
  transcendence: 6,
};

/**
 * Get the numeric phase number for a given phase name.
 * Returns 1 for unknown phase names.
 */
export function getPhaseNumber(phase: string): number {
  return PHASE_NUMBER[phase] ?? 1;
}

/**
 * Compute the production multiplier for the current progression state.
 *
 * Formula:
 *   base = 1.12 ^ phaseNumber          (×1.12 per phase reached)
 *   result = base * (1 + 0.50 * legacyPoints)  (+50% per Legacy Point)
 *
 * @param phase         Current phase name (e.g., 'combat')
 * @param legacyPoints  Accumulated Legacy Points from prestige
 * @param overridePhaseNumber  Optional override for testing (e.g., virtual phase 7)
 */
export function productionMultiplier(
  phase: string,
  legacyPoints: number,
  overridePhaseNumber?: number,
): number {
  const phaseNumber = overridePhaseNumber ?? getPhaseNumber(phase);
  const base = Math.pow(1.12, phaseNumber);
  return base * (1 + 0.50 * legacyPoints);
}

/**
 * Apply soft-cap diminishing returns to building effectiveness.
 *
 * Levels 0-5: full base effectiveness.
 * Level 6+: effectiveness = base / (1 + 0.15 * (level - 5))
 *
 * @param base   Base effectiveness at level ≤5
 * @param level  Current building level
 */
export function softCapEffectiveness(base: number, level: number): number {
  if (level <= 5) return base;
  return base / (1 + 0.15 * (level - 5));
}

/**
 * Compute worker efficiency multiplier.
 *
 * Up to 500 workers: 1.0 (full efficiency).
 * Above 500: efficiency = 1 / (1 + 0.001 * (workers - 500))
 *
 * @param workers  Total worker count
 */
export function workerEfficiency(workers: number): number {
  if (workers <= 500) return 1.0;
  return 1 / (1 + 0.001 * (workers - 500));
}

/**
 * Compute the cost to upgrade a building to the given level.
 *
 * Formula: floor(baseCost * 2.5^level)
 * Creates exponential cost walls that prestige breaks through.
 *
 * @param baseCost  Base resource cost for level 0
 * @param level     Destination level to upgrade TO (1-based).
 *                  Example: current building level 0 → pass 1 for first upgrade cost.
 *                  Actual building level before upgrade is (level - 1).
 */
export function buildingUpgradeCost(baseCost: number, level: number): number {
  return Math.floor(baseCost * Math.pow(2.5, level));
}
