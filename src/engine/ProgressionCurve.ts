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

import { PHASE_ORDER, type Phase } from '../phases/phases';
import { progressionBalance } from '../data/balance/progression';

/**
 * Get the numeric phase number for a given phase name: its position in
 * `PHASE_ORDER`, from 1 (egg_laying=1, …, transcendence=6).
 * Returns 1 for unknown phase names.
 */
export function getPhaseNumber(phase: string): number {
  return Math.max(0, PHASE_ORDER.indexOf(phase as Phase)) + 1;
}

/**
 * Compute the production multiplier for the current progression state.
 *
 * Formula:
 *   base = 1.12 ^ phaseNumber          (×1.12 per phase reached)
 *   result = base * (1 + 0.15 * legacyPoints)   (+15% per Legacy Point)
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
  const base = Math.pow(progressionBalance.productionPerPhase, phaseNumber);
  return base * (1 + progressionBalance.productionPerLegacyPoint * legacyPoints);
}

/**
 * Apply soft-cap diminishing returns to building effectiveness.
 *
 * Levels 0-5: full base effectiveness.
 * Level 6+: effectiveness = base / (1 + 0.08 * (level - 5))
 *
 * @param base   Base effectiveness at level ≤5
 * @param level  Current building level
 */
export function softCapEffectiveness(base: number, level: number): number {
  const { fullLevels, falloffPerLevel } = progressionBalance.softCap;
  if (level <= fullLevels) return base;
  return base / (1 + falloffPerLevel * (level - fullLevels));
}

/**
 * Compute worker efficiency multiplier.
 *
 * Up to 500 workers: 1.0 (full efficiency).
 * Above 500: efficiency = 1 / (1 + 0.0005 * (workers - 500))
 *
 * At 2000 workers: eff ≈ 0.57 (50% gatherers → net positive food).
 * The 0.0005 coefficient was chosen so the starvation threshold
 * (~1500 workers with 0.001) shifts past the practical game range
 * (~2500+ without prestige bonuses, higher with).
 *
 * @param workers  Total worker count
 */
export function workerEfficiency(workers: number): number {
  const { freeWorkers, falloffPerWorker } = progressionBalance.scalePenalty;
  if (workers <= freeWorkers) return 1.0;
  return 1 / (1 + falloffPerWorker * (workers - freeWorkers));
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
  return Math.floor(baseCost * Math.pow(progressionBalance.buildingCostGrowth, level));
}
