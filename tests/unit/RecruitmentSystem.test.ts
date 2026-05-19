import { describe, it, expect, beforeEach } from 'vitest';
import {
  recruitScout,
  recruitWarrior,
  getMaxScouts,
  getMaxWarriors,
} from '../../src/systems/RecruitmentSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('RecruitmentSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('getMaxScouts', () => {
    it('returns 0 when no barracks', () => {
      expect(getMaxScouts(state)).toBe(0);
    });

    it('returns 2 when barracks level 1', () => {
      state.buildings.barracks.level = 1;
      expect(getMaxScouts(state)).toBe(2);
    });

    it('returns 3 when barracks level 2', () => {
      state.buildings.barracks.level = 2;
      expect(getMaxScouts(state)).toBe(3);
    });

    it('returns 3 when barracks level 3+', () => {
      state.buildings.barracks.level = 5;
      expect(getMaxScouts(state)).toBe(3);
    });
  });

  describe('getMaxWarriors', () => {
    it('returns 0 when barracks level < 2', () => {
      state.buildings.barracks.level = 0;
      expect(getMaxWarriors(state)).toBe(0);
      state.buildings.barracks.level = 1;
      expect(getMaxWarriors(state)).toBe(0);
    });

    it('returns 2 when barracks level 2', () => {
      state.buildings.barracks.level = 2;
      expect(getMaxWarriors(state)).toBe(2);
    });

    it('returns 2 when barracks level 3+', () => {
      state.buildings.barracks.level = 3;
      expect(getMaxWarriors(state)).toBe(2);
    });
  });

  describe('recruitScout', () => {
    it('deducts 50 food and converts 1 worker to 1 scout', () => {
      state.buildings.barracks.level = 1;
      state.resources.workers = 5;
      state.resources.food = 100;
      const result = recruitScout(state);
      expect(result.resources.workers).toBe(4);
      expect(result.resources.food).toBe(50);
      expect(result.soldiers.scouts).toBe(1);
    });

    it('returns state unchanged if not enough food', () => {
      state.buildings.barracks.level = 1;
      state.resources.workers = 5;
      state.resources.food = 30;
      const result = recruitScout(state);
      expect(result).toBe(state);
    });

    it('returns state unchanged if no workers available', () => {
      state.buildings.barracks.level = 1;
      state.resources.workers = 0;
      state.resources.food = 100;
      const result = recruitScout(state);
      expect(result).toBe(state);
    });

    it('returns state unchanged if no barracks', () => {
      state.resources.workers = 5;
      state.resources.food = 100;
      const result = recruitScout(state);
      expect(result).toBe(state);
    });

    it('returns state unchanged if at scout cap', () => {
      state.buildings.barracks.level = 1; // cap = 2
      state.resources.workers = 5;
      state.resources.food = 200;
      state.soldiers.scouts = 2;
      const result = recruitScout(state);
      expect(result).toBe(state);
    });
  });

  describe('recruitWarrior', () => {
    it('deducts 100 food and converts 1 worker to 1 warrior when barracks level 2+', () => {
      state.buildings.barracks.level = 2;
      state.resources.workers = 5;
      state.resources.food = 200;
      const result = recruitWarrior(state);
      expect(result.resources.workers).toBe(4);
      expect(result.resources.food).toBe(100);
      expect(result.soldiers.warriors).toBe(1);
    });

    it('returns state unchanged if barracks level < 2', () => {
      state.buildings.barracks.level = 1;
      state.resources.workers = 5;
      state.resources.food = 200;
      const result = recruitWarrior(state);
      expect(result).toBe(state);
    });

    it('returns state unchanged if not enough food', () => {
      state.buildings.barracks.level = 2;
      state.resources.workers = 5;
      state.resources.food = 50;
      const result = recruitWarrior(state);
      expect(result).toBe(state);
    });

    it('returns state unchanged if at warrior cap', () => {
      state.buildings.barracks.level = 2;
      state.resources.workers = 5;
      state.resources.food = 500;
      state.soldiers.warriors = 2;
      const result = recruitWarrior(state);
      expect(result).toBe(state);
    });

    it('returns state unchanged if no workers available', () => {
      state.buildings.barracks.level = 2;
      state.resources.workers = 0;
      state.resources.food = 200;
      const result = recruitWarrior(state);
      expect(result).toBe(state);
    });
  });
});
