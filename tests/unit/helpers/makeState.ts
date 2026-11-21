import { createInitialState, type GameState } from '../../../src/state/GameState';

/** Every field optional, objects included; arrays are replaced whole. */
export type StateOverrides<T = GameState> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object | null ? StateOverrides<NonNullable<T[K]>> | T[K] : T[K];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function merge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v === undefined ? out[k] : merge(out[k], v);
  }
  return out as T;
}

/**
 * A fresh `createInitialState()` with the given fields deep-merged in, for
 * unit tests that set only what they assert on (Story 1.21). Arrays and
 * `null` replace the base value.
 */
export function makeState(overrides: StateOverrides = {}): GameState {
  return merge(createInitialState(), overrides);
}
