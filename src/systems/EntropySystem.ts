import type { GameState } from '../state/GameState';

/**
 * Entropy System (GM-10)
 *
 * Entropy mechanic: accumulates from darkMatter production, creates
 * double-edged threshold events. New building: Entropy Dampener
 * reduces accumulation rate by 20% per level.
 *
 * Entropy resets on prestige.
 */

/** Maximum entropy value (representing 100%). */
export const ENTROPY_MAX = 100;

/** Rate of entropy accumulation per unit of darkMatter (per tick at dtSec=1). */
export const ENTROPY_RATE_PER_DARK_MATTER = 0.1;

/** Cost to build Entropy Dampener (void crystals). */
export const ENTROPY_DAMPENER_COST_VOID_CRYSTALS = 10;

/** Cost to build Entropy Dampener (stone). */
export const ENTROPY_DAMPENER_COST_STONE = 50;

/** Threshold levels for entropy effects. */
export type EntropyThreshold = 25 | 50 | 75 | 100;

/** A threshold effect that fires when entropy crosses a boundary. */
export interface ThresholdEffect {
  /** Internal name for the effect type. */
  name: string;
  /** Human-readable description shown in event log. */
  description: string;
  /** The entropy percentage this effect triggers at. */
  threshold: EntropyThreshold;
}

/** All entropy threshold effects. */
const THRESHOLD_EFFECTS: ThresholdEffect[] = [
  {
    name: 'void_rift',
    description: 'Void rift swallowed 5 workers',
    threshold: 25,
  },
  {
    name: 'dark_surge',
    description: '+10% darkMatter, -5% food — double-edged surge',
    threshold: 50,
  },
  {
    name: 'reality_flicker',
    description: 'Reality flickers. Resource values unreliable for 30 ticks.',
    threshold: 75,
  },
  {
    name: 'prestige_glow',
    description: 'Entropy maxed. Prestige now grants bonus Legacy Points (entropy × 2).',
    threshold: 100,
  },
];

/**
 * Get the base entropy accumulation rate for the current state.
 * Rate = darkMatter * ENTROPY_RATE_PER_DARK_MATTER * dampener_reduction.
 */
export function getEntropyRate(state: GameState): number {
  const darkMatter = state.resources.darkMatter;
  if (darkMatter <= 0) return 0;

  const baseRate = darkMatter * ENTROPY_RATE_PER_DARK_MATTER;

  // Apply dampener reduction: each level reduces rate by 20% (multiplies by 0.8)
  const dampenerLevel = state.entropyDampener.level;
  if (dampenerLevel <= 0) return baseRate;

  const dampenerMultiplier = Math.pow(0.8, dampenerLevel);
  return baseRate * dampenerMultiplier;
}

/**
 * Tick entropy accumulation.
 *
 * @param state Current game state (not mutated).
 * @param dtSec Delta time in seconds (default 1 for tick-at-a-time).
 * @returns New game state with updated entropy value.
 */
export function tickEntropy(state: GameState, dtSec: number = 1): GameState {
  // Already at max — no change needed
  if (state.entropy >= ENTROPY_MAX) return state;

  const rate = getEntropyRate(state);
  if (rate <= 0) return state;

  const delta = rate * dtSec;
  const updatedEntropy = Math.min(state.entropy + delta, ENTROPY_MAX);

  return {
    ...state,
    entropy: updatedEntropy,
  };
}

/**
 * Check if entropy is currently triggering a threshold event.
 * Returns true if entropy >= 25 (the first threshold).
 */
export function isEntropyThreshold(state: GameState): boolean {
  return (state.entropy) >= 25;
}

/**
 * Get the highest threshold level that has been reached.
 * Returns the threshold boundary (25, 50, 75, or 100) or 0 if below any threshold.
 */
export function getEntropyThresholdLevel(state: GameState): number {
  const e = state.entropy;
  if (e >= 100) return 100;
  if (e >= 75) return 75;
  if (e >= 50) return 50;
  if (e >= 25) return 25;
  return 0;
}

/**
 * Get all threshold effects that are currently active based on entropy level.
 * Returns effects for all thresholds at or below current entropy.
 */
export function getActiveThresholdEffects(state: GameState): ThresholdEffect[] {
  const level = getEntropyThresholdLevel(state);
  if (level === 0) return [];

  return THRESHOLD_EFFECTS.filter((e) => e.threshold <= level);
}

/**
 * Get the current level of the Entropy Dampener building.
 */
export function getEntropyDampenerLevel(state: GameState): number {
  return state.entropyDampener.level;
}

/**
 * Attempt to build an Entropy Dampener.
 *
 * Costs: voidCrystals + stone (constants above).
 * Increases dampener level by 1.
 *
 * @returns New GameState with dampener built, or null if requirements not met.
 */
export function buildEntropyDampener(state: GameState): GameState | null {
  if (state.resources.voidCrystals < ENTROPY_DAMPENER_COST_VOID_CRYSTALS) return null;
  if (state.resources.stone < ENTROPY_DAMPENER_COST_STONE) return null;

  return {
    ...state,
    resources: {
      ...state.resources,
      voidCrystals: state.resources.voidCrystals - ENTROPY_DAMPENER_COST_VOID_CRYSTALS,
      stone: state.resources.stone - ENTROPY_DAMPENER_COST_STONE,
    },
    entropyDampener: {
      level: state.entropyDampener.level + 1,
    },
  };
}

/**
 * Reset entropy on prestige. Entropy goes to 0, dampener level is preserved.
 *
 * @returns New game state with entropy reset.
 */
export function resetEntropy(state: GameState): GameState {
  return {
    ...state,
    entropy: 0,
  };
}

/**
 * Calculate bonus Legacy Points from entropy on prestige.
 * Formula: entropy × 2 (only when entropy reaches 100%).
 *
 * @returns Bonus legacy points (0 if entropy < 100).
 */
export function calculateEntropyPrestigeBonus(state: GameState): number {
  if (state.entropy < 100) return 0;
  return Math.floor(state.entropy * 2);
}
