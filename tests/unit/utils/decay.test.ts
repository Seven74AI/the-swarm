import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { chainedShare, completedShare } from '../../../src/utils/decay';
import { creditWhole } from '../../../src/utils/math';

const rate = fc.double({ min: 1e-4, max: 2, noNaN: true });
const dt = fc.double({ min: 1e-3, max: 60, noNaN: true });

describe('pipeline flow over one step (Story 2.5)', () => {
  it('two steps of dt complete what one step of 2·dt does', () => {
    fc.assert(fc.property(rate, dt, (k, t) => {
      const one = completedShare(k, t);
      expect(1 - (1 - one) ** 2).toBeCloseTo(completedShare(k, 2 * t), 9);
    }), { seed: 25 });
  });

  it('never completes more than the pipeline holds', () => {
    fc.assert(fc.property(rate, dt, (k, t) => {
      expect(completedShare(k, t)).toBeGreaterThan(0);
      expect(completedShare(k, t)).toBeLessThanOrEqual(1);
    }), { seed: 25 });
  });

  it('the chained share is symmetric, within the first stage, and continuous where the rates meet', () => {
    fc.assert(fc.property(rate, rate, dt, (a, b, t) => {
      const c = chainedShare(a, b, t);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(completedShare(a, t) + 1e-12);
      expect(c).toBeCloseTo(chainedShare(b, a, t), 9);
      expect(chainedShare(a, a * (1 + 1e-9), t)).toBeCloseTo(chainedShare(a, a, t), 6);
    }), { seed: 25 });
  });
});

describe('creditWhole (Story 2.5)', () => {
  it('keeps the amount whole and loses nothing above zero', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1e6 }), fc.double({ min: 0, max: 0.999, noNaN: true }), fc.double({ min: -1e3, max: 1e3, noNaN: true }), (amount, rem, delta) => {
      const r = creditWhole(amount, rem, delta);
      expect(Number.isInteger(r.amount)).toBe(true);
      expect(r.amount).toBeGreaterThanOrEqual(0);
      expect(r.remainder).toBeGreaterThanOrEqual(0);
      expect(r.remainder).toBeLessThan(1);
      if (amount + rem + delta > 0) expect(r.amount + r.remainder).toBeCloseTo(amount + rem + delta, 6);
    }), { seed: 25 });
  });
});
