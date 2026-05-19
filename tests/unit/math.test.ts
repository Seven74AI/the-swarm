import { describe, it, expect } from 'vitest';
import { upgradeCost, calculateProduction, clamp } from '../../src/utils/math';

describe('upgradeCost', () => {
  it('returns baseCost at level 0', () => {
    expect(upgradeCost(10, 1.15, 0)).toBe(10);
  });

  it('returns baseCost * 1.15 at level 1', () => {
    expect(upgradeCost(10, 1.15, 1)).toBe(11);
  });

  it('returns baseCost * costMultiplier^2 at level 2', () => {
    // 10 * 1.15^2 = 10 * 1.3225 = 13.225, floor = 13
    expect(upgradeCost(10, 1.15, 2)).toBe(13);
  });

  it('scales exponentially with level', () => {
    // 100 * 1.15^10 ≈ 404.55, floor = 404
    expect(upgradeCost(100, 1.15, 10)).toBe(404);
  });

  it('works with integer baseCost and multiplier', () => {
    expect(upgradeCost(50, 2, 3)).toBe(400); // 50 * 8
  });

  it('returns 0 for baseCost 0 at any level', () => {
    expect(upgradeCost(0, 1.15, 5)).toBe(0);
  });

  it('floor handles fractional results', () => {
    // 1 * 1.15^1 = 1.15, floor = 1
    expect(upgradeCost(1, 1.15, 1)).toBe(1);
  });
});

describe('calculateProduction', () => {
  it('returns baseProduction with 0 upgrades', () => {
    expect(calculateProduction(5, 1.2, 0)).toBe(5);
  });

  it('scales linearly with upgrades', () => {
    // 5 * (1 + 1.2 * 3) = 5 * 4.6 = 23
    expect(calculateProduction(5, 1.2, 3)).toBe(23);
  });

  it('returns 0 when baseProduction is 0', () => {
    expect(calculateProduction(0, 1.5, 10)).toBe(0);
  });

  it('returns baseProduction when multiplier is 0', () => {
    expect(calculateProduction(10, 0, 5)).toBe(10);
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when value is below', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('returns max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles negative ranges', () => {
    expect(clamp(-15, -20, -10)).toBe(-15);
    expect(clamp(-25, -20, -10)).toBe(-20);
    expect(clamp(-5, -20, -10)).toBe(-10);
  });
});
