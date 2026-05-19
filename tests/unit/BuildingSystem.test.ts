import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBuildCost,
  canBuild,
  build,
  getEffects,
} from '../../src/systems/BuildingSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('BuildingSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('getBuildCost', () => {
    it('returns correct cost for barracks level 1', () => {
      const cost = getBuildCost('barracks', 1);
      expect(cost).toEqual({ food: 100, wood: 50, stone: 0, nectar: 0 });
    });

    it('returns correct cost for barracks level 2', () => {
      const cost = getBuildCost('barracks', 2);
      expect(cost).toEqual({ food: 200, wood: 100, stone: 0, nectar: 0 });
    });

    it('returns correct cost for walls level 1', () => {
      const cost = getBuildCost('walls', 1);
      expect(cost).toEqual({ food: 0, wood: 0, stone: 200, nectar: 0 });
    });

    it('returns correct cost for walls level 2 (scaled)', () => {
      const cost = getBuildCost('walls', 2);
      expect(cost).toEqual({ food: 0, wood: 0, stone: 400, nectar: 0 });
    });

    it('returns correct cost for warehouse level 1', () => {
      const cost = getBuildCost('warehouse', 1);
      expect(cost).toEqual({ food: 0, wood: 150, stone: 100, nectar: 0 });
    });

    it('returns correct cost for warehouse level 2 (scaled)', () => {
      const cost = getBuildCost('warehouse', 2);
      expect(cost).toEqual({ food: 0, wood: 300, stone: 200, nectar: 0 });
    });
  });

  describe('canBuild', () => {
    it('returns true when resources are sufficient', () => {
      state.resources.food = 200;
      state.resources.wood = 100;
      expect(canBuild('barracks', state)).toBe(true);
    });

    it('returns false when not enough food', () => {
      state.resources.food = 50;
      state.resources.wood = 100;
      expect(canBuild('barracks', state)).toBe(false);
    });

    it('returns false when not enough wood', () => {
      state.resources.food = 200;
      state.resources.wood = 10;
      expect(canBuild('barracks', state)).toBe(false);
    });

    it('returns false when not enough stone for walls', () => {
      state.resources.stone = 50;
      expect(canBuild('walls', state)).toBe(false);
    });

    it('returns true when stone is sufficient for walls', () => {
      state.resources.stone = 250;
      expect(canBuild('walls', state)).toBe(true);
    });
  });

  describe('build', () => {
    it('increments building level and deducts resources for barracks', () => {
      state.resources.food = 200;
      state.resources.wood = 100;
      const result = build('barracks', state);
      expect(result.buildings.barracks.level).toBe(1);
      expect(result.resources.food).toBe(100);
      expect(result.resources.wood).toBe(50);
    });

    it('increments building level for walls', () => {
      state.resources.stone = 300;
      const result = build('walls', state);
      expect(result.buildings.walls.level).toBe(1);
      expect(result.resources.stone).toBe(100);
    });

    it('does not modify state when cannot afford', () => {
      state.resources.food = 10;
      const result = build('barracks', state);
      expect(result).toBe(state);
    });

    it('levels up from 1 to 2 for barracks', () => {
      state.resources.food = 300;
      state.resources.wood = 150;
      state.buildings.barracks.level = 1;
      const result = build('barracks', state);
      expect(result.buildings.barracks.level).toBe(2);
      expect(result.resources.food).toBe(100); // 300 - 200
      expect(result.resources.wood).toBe(50);  // 150 - 100
    });
  });

  describe('getEffects', () => {
    it('returns correct effects for barracks level 1', () => {
      const effects = getEffects('barracks', 1);
      expect(effects).toEqual({ scoutsCap: 2, warriorsCap: 0 });
    });

    it('returns correct effects for barracks level 2', () => {
      const effects = getEffects('barracks', 2);
      expect(effects).toEqual({ scoutsCap: 3, warriorsCap: 2 });
    });

    it('returns correct effects for barracks level 0 (no barracks)', () => {
      const effects = getEffects('barracks', 0);
      expect(effects).toEqual({ scoutsCap: 0, warriorsCap: 0 });
    });

    it('returns correct effects for walls level 1', () => {
      const effects = getEffects('walls', 1);
      expect(effects).toEqual({ defenseBonus: 0.05 });
    });

    it('returns walls defense bonus for level 3', () => {
      const effects = getEffects('walls', 3);
      expect(effects.defenseBonus).toBeCloseTo(0.15);
    });

    it('returns correct effects for warehouse level 1', () => {
      const effects = getEffects('warehouse', 1);
      expect(effects).toEqual({ nestCapacity: 25 });
    });

    it('returns correct effects for warehouse level 3', () => {
      const effects = getEffects('warehouse', 3);
      expect(effects).toEqual({ nestCapacity: 75 });
    });

    it('returns zero effects for warehouse level 0', () => {
      const effects = getEffects('warehouse', 0);
      expect(effects).toEqual({ nestCapacity: 0 });
    });
  });
});
