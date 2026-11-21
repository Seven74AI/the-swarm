import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  rngStream,
  rngFromSeed,
  isRngState,
  between,
  intBetween,
  pick,
  keyedStream,
  hashString,
} from '../../../src/utils/rng';

/**
 * Story 3.1 (AR9, ADR 0005): the seeded generator. Its state is one unsigned
 * 32-bit integer, so it survives JSON and fits in `GameState.rng`.
 */
describe('rng', () => {
  const draws = (state: number, n: number): number[] => {
    const r = rngStream(state);
    return Array.from({ length: n }, () => r.float());
  };

  it('replays the same draws from the same state', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (state) => {
        expect(draws(state, 20)).toEqual(draws(state, 20));
      }),
      { seed: 31, numRuns: 50 },
    );
  });

  it('draws floats in [0, 1) and keeps a u32 state that survives JSON', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (state) => {
        const r = rngStream(state);
        for (let i = 0; i < 20; i++) {
          const x = r.float();
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
          expect(isRngState(r.state)).toBe(true);
          expect(JSON.parse(JSON.stringify(r.state))).toBe(r.state);
        }
      }),
      { seed: 31, numRuns: 50 },
    );
  });

  it('advances its state with every draw, and resuming from a state continues the sequence', () => {
    const r = rngStream(rngFromSeed(7));
    const before = r.state;
    r.float();
    expect(r.state).not.toBe(before);
    const rest = draws(r.state, 5);
    expect([r.float(), r.float(), r.float(), r.float(), r.float()]).toEqual(rest);
  });

  it('different seeds give different sequences', () => {
    expect(draws(rngFromSeed(1), 5)).not.toEqual(draws(rngFromSeed(2), 5));
  });

  it('rngFromSeed gives a valid generator state for every seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        expect(isRngState(rngFromSeed(seed))).toBe(true);
      }),
      { seed: 31, numRuns: 50 },
    );
    for (const bad of [-1, 1.5, NaN, 2 ** 32, '1', null]) expect(isRngState(bad)).toBe(false);
  });

  it('between, intBetween and pick stay in range; intBetween gives integers and reaches both ends', () => {
    const r = rngStream(rngFromSeed(99));
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const f = between(r, 0.85, 1.15);
      expect(f).toBeGreaterThanOrEqual(0.85);
      expect(f).toBeLessThan(1.15);
      const n = intBetween(r, 2, 5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
      seen.add(n);
      expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']));
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('keyed streams depend only on their keys', () => {
    expect(draws(keyedStream(1, 2, 3).state, 3)).toEqual(draws(keyedStream(1, 2, 3).state, 3));
    expect(keyedStream(1, 2, 3).float()).not.toBe(keyedStream(1, 2, 4).float());
    expect(keyedStream(1, 2, 3).float()).not.toBe(keyedStream(2, 2, 3).float());
    expect(hashString('exp_1')).toBe(hashString('exp_1'));
    expect(hashString('exp_1')).not.toBe(hashString('exp_2'));
    expect(isRngState(hashString('spc_12'))).toBe(true);
  });
});
