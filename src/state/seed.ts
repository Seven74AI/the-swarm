/**
 * The game's seed (Story 1.34; arch D6, ADR 0005). An unsigned 32-bit integer
 * saved in `GameState.seed`, shown in the debug overlay and written into
 * exported diagnostics, so a reported bug names the seed it ran with.
 * Story 3.1 builds the seeded generator from it.
 */

/** Seeds are unsigned 32-bit integers: 0 … SEED_LIMIT − 1. */
export const SEED_LIMIT = 2 ** 32;

/** The seed of `createInitialState()`; a new game gets a fresh one at boot (main). */
export const DEFAULT_SEED = 1;

export function isSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < SEED_LIMIT;
}

/**
 * A seed derived from any number, the same for the same input (a 32-bit
 * integer hash), so a migrated save gets a stable seed.
 */
export function seedFrom(value: number): number {
  let h = Math.floor(Math.abs(Number.isFinite(value) ? value : 0) % 2 ** 52) >>> 0;
  h ^= Math.floor(value / 2 ** 32) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A fresh seed from a source of randomness in [0, 1). */
export function randomSeed(rand: () => number): number {
  return Math.floor(rand() * SEED_LIMIT) >>> 0;
}
