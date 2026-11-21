/**
 * The seeded generator (Story 3.1, AR9, arch D6, ADR 0005).
 *
 * The generator is mulberry32: its whole state is one unsigned 32-bit integer,
 * kept in `GameState.rng` and saved with the game. A system never calls
 * `Math.random`; it draws from an `RngStream`:
 *
 * - In a tick, from `ctx.rng` (the tick context), opened on `state.rng` at the
 *   tick's start; the tick folds `ctx.rng.state` back into its one write.
 * - In an action (a battle, a launch), from `rngStream(state.rng)`; the action
 *   writes the advanced `stream.state` back with the rest of its result.
 *
 * Outcomes of things that run over game time (expeditions, explorations,
 * probe launches) are drawn from a `keyedStream` of the seed and what they
 * are (their id, the game tick), not from the shared stream, so they don't
 * depend on how long the simulation steps are or in what order they resolve
 * (Story 2.5 step-length invariance, Story 2.6 macro-steps).
 *
 * UI-only effects (particles, noise) may still use `Math.random`.
 */

/** Generator states are unsigned 32-bit integers. */
const U32 = 2 ** 32;

/** A source of uniform draws over a saved generator state. */
export interface RngStream {
  /** The generator state after the draws so far: save this to continue the sequence. */
  readonly state: number;
  /** Uniform in [0, 1). */
  float(): number;
}

class Mulberry32 implements RngStream {
  constructor(public state: number) {}

  float(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / U32;
  }
}

export function isRngState(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < U32;
}

/** A stream that continues from `state` (a stream's `state`, or `rngFromSeed`). */
export function rngStream(state: number): RngStream {
  return new Mulberry32(state >>> 0);
}

/** The generator state a game with this seed starts from. */
export function rngFromSeed(seed: number): number {
  return seed >>> 0;
}

/** A float in [min, max). */
export function between(rng: RngStream, min: number, max: number): number {
  return min + rng.float() * (max - min);
}

/** An integer from `min` to `max`, both included. */
export function intBetween(rng: RngStream, min: number, max: number): number {
  return Math.min(max, min + Math.floor(rng.float() * (max - min + 1)));
}

/** One of `items` (not empty), each equally likely. */
export function pick<T>(rng: RngStream, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng.float() * items.length))];
}

/** True with probability `p`. */
export function chance(rng: RngStream, p: number): boolean {
  return rng.float() < p;
}

function fmix(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A 32-bit hash of a string (an id), for `keyedStream`. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return fmix(h >>> 0);
}

/**
 * A stream that depends only on `keys` (integers): the same keys always give
 * the same draws. For outcomes fixed by what they are rather than by when
 * they are drawn.
 */
export function keyedStream(...keys: number[]): RngStream {
  let h = 0x9e3779b9;
  for (const k of keys) {
    const lo = k >>> 0;
    const hi = Math.floor(k / U32) >>> 0;
    h = fmix((h ^ lo) >>> 0);
    h = fmix((h ^ hi) >>> 0);
  }
  return rngStream(h);
}
