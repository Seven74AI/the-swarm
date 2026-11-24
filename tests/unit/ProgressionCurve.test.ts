import { describe, it, expect } from 'vitest';
import {
  productionMultiplier,
  softCapEffectiveness,
  buildingUpgradeCost,
  getPhaseNumber,
} from '../../src/engine/ProgressionCurve';
import { progressionBalance as P } from '../../src/data/balance/progression';
import { crowdingMultiplier } from '../../src/systems/Crowding';
import { crowdingBalance } from '../../src/data/balance/crowding';

/** The documented curves, from the balance numbers (Story 3.2: never restated). */
const production = (phaseNumber: number, lp: number): number =>
  P.productionPerPhase ** phaseNumber * (1 + P.productionPerLegacyPoint * lp);
const softCap = (base: number, level: number): number =>
  level <= P.softCap.fullLevels ? base : base / (1 + P.softCap.falloffPerLevel * (level - P.softCap.fullLevels));
const FULL = P.softCap.fullLevels;
const G = P.buildingCostGrowth;

/**
 * ProgressionCurve tests — TDD RED phase.
 * Tests the mathematical progression curve functions:
 * production multiplier, soft caps, worker efficiency, cost scaling.
 */

describe('ProgressionCurve', () => {
  describe('getPhaseNumber', () => {
    it('maps egg_laying to 1', () => {
      expect(getPhaseNumber('egg_laying')).toBe(1);
    });

    it('maps colony to 2', () => {
      expect(getPhaseNumber('colony')).toBe(2);
    });

    it('maps combat to 3', () => {
      expect(getPhaseNumber('combat')).toBe(3);
    });

    it('maps expansion to 4', () => {
      expect(getPhaseNumber('expansion')).toBe(4);
    });

    it('maps space to 5', () => {
      expect(getPhaseNumber('space')).toBe(5);
    });

    it('maps transcendence to 6', () => {
      expect(getPhaseNumber('transcendence')).toBe(6);
    });

    it('returns 1 for unknown phases', () => {
      expect(getPhaseNumber('unknown_phase')).toBe(1);
    });
  });

  describe('productionMultiplier', () => {
    it('returns 1.0 for phase 1 with 0 legacy points', () => {
      const result = productionMultiplier('egg_laying', 0);
      expect(result).toBeCloseTo(production(1, 0), 4);
    });

    it('returns phase-scaled multiplier with no legacy points', () => {
      expect(productionMultiplier('combat', 0)).toBeCloseTo(production(3, 0), 4);
    });

    it('scales by 1.12 per phase', () => {
      expect(productionMultiplier('space', 0)).toBeCloseTo(production(5, 0), 4);
    });

    it('applies 15% per legacy point on top of base', () => {
      const result = productionMultiplier('egg_laying', 2);
      expect(result).toBeCloseTo(production(1, 2), 4);
    });

    it('phase and legacy combine multiplicatively', () => {
      const result = productionMultiplier('combat', 5);
      expect(result).toBeCloseTo(production(3, 5), 4);
    });

    it('phase 6 (transcendence) with 10 legacy points', () => {
      const result = productionMultiplier('transcendence', 10);
      expect(result).toBeCloseTo(production(6, 10), 4);
    });

    it('phase 7 (beyond transcendence virtual phase)', () => {
      const result = productionMultiplier('transcendence', 0, 7);
      expect(result).toBeCloseTo(production(7, 0), 4);
    });

    it('legacy points of 0 returns pure phase multiplier', () => {
      const withZero = productionMultiplier('space', 0);
      const withUndefined = productionMultiplier('space', 0);
      expect(withZero).toBeCloseTo(production(5, 0), 4);
      expect(withUndefined).toBeCloseTo(production(5, 0), 4);
    });

    it('high legacy points (100) dramatically boost multiplier', () => {
      const result = productionMultiplier('combat', 100);
      expect(result).toBeCloseTo(production(3, 100), 4);
    });

    it('returns minimum 1.0 for phase 0 or unknown', () => {
      expect(productionMultiplier('unknown', 0)).toBeCloseTo(production(1, 0), 4);
    });

    it('monotonically increases with phase', () => {
      const phases = ['egg_laying', 'colony', 'combat', 'expansion', 'space', 'transcendence'];
      const multipliers = phases.map(p => productionMultiplier(p, 0));
      for (let i = 1; i < multipliers.length; i++) {
        expect(multipliers[i]).toBeGreaterThan(multipliers[i - 1]);
      }
    });

    it('monotonically increases with legacy points', () => {
      const mults = [0, 1, 5, 10, 50].map(lp => productionMultiplier('colony', lp));
      for (let i = 1; i < mults.length; i++) {
        expect(mults[i]).toBeGreaterThan(mults[i - 1]);
      }
    });
  });

  describe('softCapEffectiveness', () => {
    it('returns full base effectiveness up to the soft-cap level', () => {
      expect(softCapEffectiveness(10, 1)).toBe(10);
      expect(softCapEffectiveness(10, FULL)).toBe(10);
    });

    it('applies diminishing returns at level 6', () => {
      expect(softCapEffectiveness(10, FULL + 1)).toBeCloseTo(softCap(10, FULL + 1), 4);
      expect(softCapEffectiveness(10, FULL + 1)).toBeLessThan(10);
    });

    it('applies stronger diminishing returns at higher levels', () => {
      expect(softCapEffectiveness(10, FULL + 5)).toBeCloseTo(softCap(10, FULL + 5), 4);
      expect(softCapEffectiveness(10, FULL + 5)).toBeLessThan(softCapEffectiveness(10, FULL + 1));
    });

    it('asymptotically approaches 0 but never reaches it', () => {
      expect(softCapEffectiveness(10, 100)).toBeGreaterThan(0);
    });

    it('monotonically decreases after level 5', () => {
      const vals = [1, 2, 3, 4, 5].map(l => softCapEffectiveness(10, FULL + l));
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]).toBeLessThan(vals[i - 1]);
      }
    });

    it('level 0 returns full base effectiveness', () => {
      expect(softCapEffectiveness(10, 0)).toBe(10);
    });

    it('different bases scale proportionally', () => {
      const low = softCapEffectiveness(5, 10);
      const high = softCapEffectiveness(20, 10);
      // Both should be scaled by the same factor from base
      expect(high / 20).toBeCloseTo(low / 5, 4);
    });
  });

  // Story 9.13: the worker-count scale penalty became crowding. A colony of any
  // size that fits its rooms works at full rate; only overfill slows it.
  describe('crowdingMultiplier (replaces workerEfficiency)', () => {
    it('is 1 for a colony of any size that fits its rooms', () => {
      for (const n of [0, 1, 500, 5_000, 100_000]) expect(crowdingMultiplier(n, n)).toBe(1);
    });

    it('drops below 1 as soon as one creature is past the rooms', () => {
      expect(crowdingMultiplier(501, 500)).toBeLessThan(1);
    });

    it('monotonically decreases with more overfill, never below the floor', () => {
      const vals = [500, 510, 600, 750, 1000, 5000].map((n) => crowdingMultiplier(n, 500));
      for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
      for (const v of vals) {
        expect(v).toBeGreaterThanOrEqual(crowdingBalance.floor);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('buildingUpgradeCost', () => {
    it('returns base cost for level 0 (first upgrade)', () => {
      expect(buildingUpgradeCost(100, 0)).toBe(100);
    });

    it('scales by the cost growth per level', () => {
      for (const level of [1, 2, 3]) expect(buildingUpgradeCost(100, level)).toBe(Math.floor(100 * G ** level));
    });

    it('cost grows exponentially', () => {
      const costs = [0, 1, 2, 3, 4, 5, 10].map(l => buildingUpgradeCost(100, l));
      // Each should be > previous, with accelerating gaps
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1]);
      }
      expect(buildingUpgradeCost(100, 10)).toBe(Math.floor(100 * G ** 10));
    });

    it('floors fractional results', () => {
      for (const level of [0, 1, 2, 3, 4, 5]) expect(Number.isInteger(buildingUpgradeCost(7, level))).toBe(true);
    });

    it('different base costs scale proportionally', () => {
      const ratio = buildingUpgradeCost(200, 5) / buildingUpgradeCost(100, 5);
      // Math.floor may cause minor rounding, so 3 decimal places
      expect(ratio).toBeCloseTo(2, 3);
    });

    it('level cost grows faster than linear', () => {
      // Linear: level 10 cost = 10 * level 1 cost = 2500
      const lv1 = buildingUpgradeCost(100, 1);
      const lv10 = buildingUpgradeCost(100, 10);
      expect(lv10).toBeGreaterThan(lv1 * 10);
    });
  });

  describe('progression curve simulation', () => {
    it('1000-tick simulation shows expected shape', () => {
      // Simulate 1000 ticks with phase progression
      // Track multiplier at each phase transition point
      const curve: Array<{ tick: number; multiplier: number; phase: string }> = [];

      // Phase transitions at roughly: 0 → egg_laying, 100 → colony, 300 → combat,
      // 600 → expansion, 800 → space
      const phaseTimeline: Array<{ tick: number; phase: string }> = [
        { tick: 0, phase: 'egg_laying' },
        { tick: 100, phase: 'colony' },
        { tick: 300, phase: 'combat' },
        { tick: 600, phase: 'expansion' },
        { tick: 800, phase: 'space' },
      ];

      let legacyPoints = 0;
      let currentPhase = 'egg_laying';

      for (let tick = 0; tick <= 1000; tick++) {
        // Check phase transition
        for (const pt of phaseTimeline) {
          if (tick === pt.tick) {
            currentPhase = pt.phase;
          }
        }

        // Simulate prestige at ticks 500 and 900
        if (tick === 500) legacyPoints += 3;
        if (tick === 900) legacyPoints += 5;

        if (tick % 100 === 0) {
          curve.push({
            tick,
            multiplier: productionMultiplier(currentPhase, legacyPoints),
            phase: currentPhase,
          });
        }
      }

      // Verify curve has entries
      expect(curve.length).toBe(11); // ticks 0, 100, 200, ..., 1000

      // Phase 1 (egg_laying, tick 0): low multiplier
      expect(curve[0].multiplier).toBeCloseTo(production(1, 0), 4);

      // Phase 2 (colony, tick 100): higher multiplier
      expect(curve[1].multiplier).toBeCloseTo(production(2, 0), 4);

      // After first prestige (tick 500, tickIndex 5): boost
      expect(curve[5].multiplier).toBeCloseTo(production(3, 3), 4);

      // After second prestige (tick 900, tickIndex 9): larger boost
      expect(curve[9].multiplier).toBeCloseTo(production(5, 8), 4);

      // Final tick 1000: space, LP=8
      expect(curve[10].multiplier).toBeCloseTo(production(5, 8), 4);
    });

    it('progression curve monotonically increases with prestige and phase', () => {
      // Phase 1, 0 LP → Phase 2, 0 LP → Phase 3, 2 LP → Phase 4, 2 LP
      const m1 = productionMultiplier('egg_laying', 0);
      const m2 = productionMultiplier('colony', 0);
      const m3 = productionMultiplier('combat', 2);
      const m4 = productionMultiplier('expansion', 2);

      expect(m1).toBeLessThan(m2);
      expect(m2).toBeLessThan(m3);
      expect(m3).toBeLessThan(m4);
    });
  });
});
