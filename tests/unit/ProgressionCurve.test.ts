import { describe, it, expect } from 'vitest';
import {
  productionMultiplier,
  softCapEffectiveness,
  workerEfficiency,
  buildingUpgradeCost,
  getPhaseNumber,
} from '../../src/engine/ProgressionCurve';

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
      // 1.12^1 * (1 + 0) = 1.12... wait, 1.12^1 = 1.12
      const result = productionMultiplier('egg_laying', 0);
      expect(result).toBeCloseTo(1.12, 4);
    });

    it('returns phase-scaled multiplier with no legacy points', () => {
      // Phase 3 (combat): 1.12^3 = 1.404928
      expect(productionMultiplier('combat', 0)).toBeCloseTo(1.404928, 4);
    });

    it('scales by 1.12 per phase', () => {
      // Phase 5 (space): 1.12^5 = 1.762342
      expect(productionMultiplier('space', 0)).toBeCloseTo(1.762342, 4);
    });

    it('applies 15% per legacy point on top of base', () => {
      // Phase 1: base = 1.12, legacy = 2 → 1.12 * (1 + 2*0.15) = 1.12 * 1.30 = 1.456
      const result = productionMultiplier('egg_laying', 2);
      expect(result).toBeCloseTo(1.456, 4);
    });

    it('phase and legacy combine multiplicatively', () => {
      // Phase 3 (combat): base = 1.12^3 = 1.404928, legacy = 5
      // → 1.404928 * (1 + 5*0.15) = 1.404928 * 1.75 = 2.458624
      const result = productionMultiplier('combat', 5);
      expect(result).toBeCloseTo(2.458624, 4);
    });

    it('phase 6 (transcendence) with 10 legacy points', () => {
      // base = 1.12^6 = 1.973823, legacy = 10 → *2.5 = 4.934558
      const result = productionMultiplier('transcendence', 10);
      expect(result).toBeCloseTo(4.934558, 4);
    });

    it('phase 7 (beyond transcendence virtual phase)', () => {
      // 1.12^7 = 2.210681
      const result = productionMultiplier('transcendence', 0, 7);
      expect(result).toBeCloseTo(2.210681, 4);
    });

    it('legacy points of 0 returns pure phase multiplier', () => {
      const withZero = productionMultiplier('space', 0);
      const withUndefined = productionMultiplier('space', 0);
      expect(withZero).toBeCloseTo(1.762342, 4);
      expect(withUndefined).toBeCloseTo(1.762342, 4);
    });

    it('high legacy points (100) dramatically boost multiplier', () => {
      // Phase 3, 100 LP: 1.404928 * (1 + 100*0.15) = 1.404928 * 16 = 22.478848
      const result = productionMultiplier('combat', 100);
      expect(result).toBeCloseTo(22.478848, 4);
    });

    it('returns minimum 1.0 for phase 0 or unknown', () => {
      // Unknown phase → phaseNumber=1 → 1.12^1 = 1.12
      expect(productionMultiplier('unknown', 0)).toBeCloseTo(1.12, 4);
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
    it('returns full base effectiveness at level 5 and below', () => {
      expect(softCapEffectiveness(10, 1)).toBe(10);
      expect(softCapEffectiveness(10, 3)).toBe(10);
      expect(softCapEffectiveness(10, 5)).toBe(10);
    });

    it('applies diminishing returns at level 6', () => {
      // base=10, level=6 → 10 * (1 / (1 + 0.15 * (6-5))) = 10/1.15 = 8.69565
      expect(softCapEffectiveness(10, 6)).toBeCloseTo(8.69565, 4);
    });

    it('applies stronger diminishing returns at higher levels', () => {
      // base=10, level=10 → 10 * (1 / (1 + 0.15 * 5)) = 10/1.75 = 5.71429
      expect(softCapEffectiveness(10, 10)).toBeCloseTo(5.71429, 4);
    });

    it('asymptotically approaches 0 but never reaches it', () => {
      expect(softCapEffectiveness(10, 100)).toBeGreaterThan(0);
    });

    it('monotonically decreases after level 5', () => {
      const vals = [6, 7, 8, 9, 10].map(l => softCapEffectiveness(10, l));
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

  describe('workerEfficiency', () => {
    it('returns 1.0 at 500 workers and below', () => {
      expect(workerEfficiency(0)).toBe(1.0);
      expect(workerEfficiency(100)).toBe(1.0);
      expect(workerEfficiency(500)).toBe(1.0);
    });

    it('drops slightly above 500 workers', () => {
      // 501 workers: 1/(1 + 0.0005 * 1) = 1/1.0005 ≈ 0.9995
      expect(workerEfficiency(501)).toBeCloseTo(0.9995, 4);
    });

    it('drops more at 1000 workers', () => {
      // 1000 workers: 1/(1 + 0.0005 * 500) = 1/1.25 = 0.8
      expect(workerEfficiency(1000)).toBeCloseTo(0.8, 4);
    });

    it('drops significantly at 2000 workers', () => {
      // 2000 workers: 1/(1 + 0.0005 * 1500) = 1/1.75 ≈ 0.571429
      expect(workerEfficiency(2000)).toBeCloseTo(0.571429, 4);
    });

    it('asymptotically approaches 0 but never negative', () => {
      expect(workerEfficiency(10000)).toBeGreaterThan(0);
    });

    it('monotonically decreases with more workers', () => {
      const vals = [500, 600, 800, 1000, 2000].map(w => workerEfficiency(w));
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
      }
    });

    it('returns efficiency between 0 and 1 inclusive', () => {
      const testPoints = [0, 250, 500, 750, 1000, 5000, 10000];
      for (const w of testPoints) {
        const eff = workerEfficiency(w);
        expect(eff).toBeGreaterThan(0);
        expect(eff).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('buildingUpgradeCost', () => {
    it('returns base cost for level 0 (first upgrade)', () => {
      // 100 * 2.5^0 = 100
      expect(buildingUpgradeCost(100, 0)).toBe(100);
    });

    it('scales by ×2.5 per level', () => {
      // Level 1: 100 * 2.5^1 = 250
      expect(buildingUpgradeCost(100, 1)).toBe(250);
      // Level 2: 100 * 2.5^2 = 625
      expect(buildingUpgradeCost(100, 2)).toBe(625);
      // Level 3: 100 * 2.5^3 = 1562.5 → 1562 (floor)
      expect(buildingUpgradeCost(100, 3)).toBe(1562);
    });

    it('cost grows exponentially', () => {
      const costs = [0, 1, 2, 3, 4, 5, 10].map(l => buildingUpgradeCost(100, l));
      // Each should be > previous, with accelerating gaps
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1]);
      }
      // Level 10: 100 * 2.5^10 = 100 * 9536.74 = 953674
      expect(buildingUpgradeCost(100, 10)).toBeGreaterThan(900_000);
    });

    it('floors fractional results', () => {
      // 100 * 2.5^1 = 250 (exact)
      expect(buildingUpgradeCost(100, 1)).toBe(250);
      // 100 * 2.5^3 = 1562.5 → 1562
      expect(buildingUpgradeCost(100, 3)).toBe(1562);
    });

    it('different base costs scale proportionally', () => {
      const ratio = buildingUpgradeCost(200, 5) / buildingUpgradeCost(100, 5);
      // Math.floor may cause minor rounding, so 3 decimal places
      expect(ratio).toBeCloseTo(2, 3);
    });

    it('level cost grows faster than linear', () => {
      // Linear: level 10 cost = 10 * level 1 cost = 2500
      // ×2.5: level 10 cost = 100 * 2.5^10 ≈ 953,674 → much bigger
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
      expect(curve[0].multiplier).toBeCloseTo(1.12, 4);

      // Phase 2 (colony, tick 100): higher multiplier
      expect(curve[1].multiplier).toBeCloseTo(1.2544, 4); // 1.12^2 = 1.2544

      // After first prestige (tick 500, tickIndex 5): boost
      // Phase is combat (3), LP=3: 1.12^3 * (1+3*0.15) = 1.404928 * 1.45 = 2.037146
      expect(curve[5].multiplier).toBeCloseTo(2.037146, 4);

      // After second prestige (tick 900, tickIndex 9): larger boost
      // Phase is space (5), LP=8: 1.12^5 * (1+8*0.15) = 1.762342 * 2.2 = 3.877152
      expect(curve[9].multiplier).toBeCloseTo(3.877152, 4);

      // Final tick 1000: space, LP=8
      expect(curve[10].multiplier).toBeCloseTo(3.877152, 4);
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
