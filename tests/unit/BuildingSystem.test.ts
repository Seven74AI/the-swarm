import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { canBuild, build, getBuildCost, getEffects, type BuildingType } from '../../src/systems/BuildingSystem';

/**
 * BuildingSystem tests — behavior-focused.
 * Tests cost/effect direction, resource deduction, invariants,
 * exponential cost scaling (×2.5), and soft-cap diminishing returns.
 */
describe('BuildingSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('getBuildCost', () => {
    it('returns positive costs for all building types', () => {
      const types: BuildingType[] = ['barracks', 'walls', 'warehouse'];
      for (const type of types) {
        const cost = getBuildCost(type, 1);
        expect(cost.food + cost.wood + cost.stone + cost.nectar).toBeGreaterThan(0);
      }
    });

    it('higher levels cost more', () => {
      const lv1 = getBuildCost('barracks', 1);
      const lv2 = getBuildCost('barracks', 2);
      expect(lv2.food).toBeGreaterThan(lv1.food);
    });

    // GM-5: Exponential cost scaling (×2.5 per level)
    it('cost scales by ×2.5 per level (exponential)', () => {
      // Level 1: 100 * 2.5^1 = 250
      expect(getBuildCost('barracks', 1).food).toBe(250);
      // Level 2: 100 * 2.5^2 = 625
      expect(getBuildCost('barracks', 2).food).toBe(625);
      // Level 3: 100 * 2.5^3 = 1562 (floored)
      expect(getBuildCost('barracks', 3).food).toBe(1562);
    });

    it('cost ratio between consecutive levels is ~2.5', () => {
      const lv1 = getBuildCost('barracks', 1).food;
      const lv2 = getBuildCost('barracks', 2).food;
      const lv3 = getBuildCost('barracks', 3).food;
      // With Math.floor, ratio should be approximately 2.5
      expect(lv2 / lv1).toBeCloseTo(2.5, 0);
      expect(lv3 / lv2).toBeCloseTo(2.5, 0);
    });

    it('cost grows much faster than linear', () => {
      const lv1 = getBuildCost('walls', 1).stone; // 200 * 2.5 = 500
      const lv5 = getBuildCost('walls', 5).stone; // 200 * 2.5^5 = 19531
      expect(lv5).toBeGreaterThan(lv1 * 10); // exponential >> linear
    });

    it('wood cost for barracks scales correctly', () => {
      // Barracks wood base = 50
      expect(getBuildCost('barracks', 1).wood).toBe(125);  // 50 * 2.5
      expect(getBuildCost('barracks', 2).wood).toBe(312);  // 50 * 6.25 = 312.5 → 312
    });

    it('warehouse costs scale with both wood and stone', () => {
      // Warehouse: wood=150, stone=100
      expect(getBuildCost('warehouse', 1).wood).toBe(375);  // 150 * 2.5
      expect(getBuildCost('warehouse', 1).stone).toBe(250); // 100 * 2.5
    });
  });

  describe('canBuild', () => {
    it('cannot build without resources', () => {
      expect(canBuild('barracks', state)).toBe(false);
    });

    it('can build with enough resources', () => {
      state.resources.food = 1000;
      state.resources.wood = 1000;
      state.resources.stone = 1000;
      state.resources.nectar = 1000;
      expect(canBuild('barracks', state)).toBe(true);
    });

    it('cannot build if resources barely insufficient', () => {
      // Level 1 barracks: 250 food, 125 wood
      state.resources.food = 250;
      state.resources.wood = 124; // 1 short
      expect(canBuild('barracks', state)).toBe(false);
    });

    it('can build multiple levels with massive resources', () => {
      state.resources.food = 100000;
      state.resources.wood = 100000;
      state.resources.stone = 100000;
      state.resources.nectar = 100000;
      // Should be able to build level 5 (huge cost)
      expect(canBuild('barracks', state)).toBe(true);
    });
  });

  describe('build', () => {
    it('increments building level on success', () => {
      state.resources.food = 1000;
      state.resources.wood = 1000;
      state.resources.stone = 1000;
      state.resources.nectar = 1000;
      const before = state.buildings.barracks.level;
      const result = build('barracks', state);
      expect(result.buildings.barracks.level).toBeGreaterThan(before);
    });

    it('deducts resources on build', () => {
      state.resources.food = 1000;
      state.resources.wood = 1000;
      state.resources.stone = 1000;
      state.resources.nectar = 1000;
      const result = build('barracks', state);
      expect(result.resources.food).toBeLessThan(state.resources.food);
    });

    it('returns unchanged state if insufficient resources', () => {
      const result = build('barracks', state);
      expect(result).toBe(state);
    });

    it('never deducts below zero', () => {
      state.resources.food = 1000;
      state.resources.wood = 1000;
      state.resources.stone = 1000;
      state.resources.nectar = 1000;
      const result = build('barracks', state);
      expect(result.resources.food).toBeGreaterThanOrEqual(0);
      expect(result.resources.wood).toBeGreaterThanOrEqual(0);
      expect(result.resources.stone).toBeGreaterThanOrEqual(0);
      expect(result.resources.nectar).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEffects', () => {
    it('returns positive effects for each building', () => {
      const types: BuildingType[] = ['barracks', 'walls', 'warehouse'];
      for (const type of types) {
        const effects = getEffects(type, 1);
        const total = Object.values(effects).reduce((a, b) => a + b, 0);
        expect(total).toBeGreaterThan(0);
      }
    });

    it('higher level gives better effects', () => {
      const lv1 = getEffects('barracks', 1);
      const lv2 = getEffects('barracks', 2);
      const sum1 = Object.values(lv1).reduce((a, b) => a + b, 0);
      const sum2 = Object.values(lv2).reduce((a, b) => a + b, 0);
      // Level 2 should not be worse than level 1
      expect(sum2).toBeGreaterThanOrEqual(sum1);
    });

    it('level 0 gives zero or minimal effects', () => {
      const effects = getEffects('barracks', 0);
      const total = Object.values(effects).reduce((a, b) => a + b, 0);
      // Level 0 should not give substantial bonuses
      expect(total).toBeLessThanOrEqual(0);
    });

    // GM-5: Soft cap diminishing returns after level 5
    it('applies diminishing returns after level 5 (walls defense)', () => {
      // Level 5 walls: defense = 5 * 0.05 = 0.25 (no cap)
      const lv5 = getEffects('walls', 5);
      expect(lv5.defenseBonus).toBeCloseTo(0.25, 4);

      // Level 6 walls: raw = 6*0.05 = 0.30, cap = 0.30/(1+0.15*1) = 0.2609
      const lv6 = getEffects('walls', 6);
      expect(lv6.defenseBonus).toBeLessThan(0.30); // less than raw
      expect(lv6.defenseBonus).toBeCloseTo(0.26087, 4);
      // Should still be >= level 5 (monotonic)
      expect(lv6.defenseBonus).toBeGreaterThanOrEqual(lv5.defenseBonus);
    });

    it('applies diminishing returns after level 5 (warehouse capacity)', () => {
      // Level 10 warehouse: raw = 10*25 = 250, cap = 250/(1+0.15*5) = 250/1.75 = 142.857
      const lv10 = getEffects('warehouse', 10);
      expect(lv10.nestCapacity).toBeGreaterThan(0);
      expect(lv10.nestCapacity).toBeLessThan(250); // less than raw
    });

    it('soft cap ensures monotonic increase even with diminishing returns', () => {
      const effects = [5, 6, 7, 8, 9, 10].map(l => getEffects('walls', l).defenseBonus);
      for (let i = 1; i < effects.length; i++) {
        expect(effects[i]).toBeGreaterThanOrEqual(effects[i - 1]);
      }
    });
  });
});
