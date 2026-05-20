import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { canBuild, build, getBuildCost, getEffects, type BuildingType } from '../../src/systems/BuildingSystem';

/**
 * BuildingSystem tests — behavior-focused.
 * Tests cost/effect direction, resource deduction, and invariants.
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
  });
});
