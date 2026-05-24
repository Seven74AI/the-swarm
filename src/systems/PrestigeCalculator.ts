import { getPhaseNumber } from '../engine/ProgressionCurve';

/**
 * Phase multipliers for the Prestige Point formula.
 * Phase 1 (egg_laying): 1.0
 * Phase 2 (colony): 1.375
 * Phase 3 (combat): 1.75
 * Phase 4 (expansion): 2.125
 * Phase 5 (space): 2.5
 * Phase 6 (transcendence): 2.5 (caps at phase 5 multiplier)
 */
const PHASE_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 1.375,
  3: 1.75,
  4: 2.125,
  5: 2.5,
};

/**
 * Calculate Prestige Points earned from total lifetime resources.
 *
 * Formula: floor(sqrt(totalLifetimeResources / 1000) * phaseMultiplier)
 *
 * All values are integers (Resource Integer Rule). Uses Math.floor.
 *
 * @param totalLifetimeResources  Total resources ever produced.
 * @param phase                   Current phase name (e.g., 'combat').
 * @returns                       Integer Prestige Points earned.
 */
export function calculatePrestigePoints(
  totalLifetimeResources: number,
  phase: string,
): number {
  if (totalLifetimeResources <= 0) return 0;

  const phaseNum = getPhaseNumber(phase);
  const multiplier = PHASE_MULTIPLIER[Math.min(phaseNum, 5)] ?? 1.0;

  const points = Math.sqrt(totalLifetimeResources / 1000) * multiplier;
  return Math.floor(points);
}

/**
 * Get the phase multiplier for testing and inspection.
 * Returns 1.0 for unknown/invalid phase numbers.
 */
export function getPhaseMultiplier(phase: string): number {
  const phaseNum = getPhaseNumber(phase);
  return PHASE_MULTIPLIER[Math.min(phaseNum, 5)] ?? 1.0;
}
