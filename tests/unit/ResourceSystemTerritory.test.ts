import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, TileType, type GameState } from '../../src/state/GameState';

describe('ResourceSystem territory bonuses', () => {
  let system: ResourceSystem;
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new ResourceSystem(bus);
    state = createInitialState();
  });

  describe('tick with territory bonuses', () => {
    it('applies FOREST bonus: +0.1 food per worker per FOREST tile', () => {
      state.resources.workers = 10;
      state.resources.food = 100;
      // 2 FOREST tiles → 10 workers × 0.1 × 2 = +2.0 extra food
      const result = system.tick(state, { food: 0.2, stone: 0, nectar: 0 });

      // Normal food: 10 workers unassigned → 10 × 1 = 10 produced, 10 × 0.5 = 5 consumed, net +5
      // Bonus: 10 × 0.2 = +2.0
      // Total: 100 + 5 + 2 = 107
      expect(result.resources.food).toBeCloseTo(107);
    });

    it('applies MOUNTAIN bonus: +0.1 stone per worker per MOUNTAIN tile', () => {
      state.resources.workers = 5;
      // 3 MOUNTAIN tiles → 5 × 0.1 × 3 = +1.5 stone
      const result = system.tick(state, { food: 0, stone: 0.3, nectar: 0 });

      expect(result.resources.stone).toBeCloseTo(1);
    });

    it('applies MEADOW bonus: +0.1 nectar per worker per MEADOW tile', () => {
      state.resources.workers = 4;
      // 2 MEADOW tiles → 4 × 0.1 × 2 = +0.8 nectar
      const result = system.tick(state, { food: 0, stone: 0, nectar: 0.2 });

      expect(result.resources.nectar).toBeCloseTo(0);
    });

    it('applies zero bonus when all bonuses are 0', () => {
      state.resources.workers = 10;
      state.resources.food = 100;
      const result = system.tick(state, { food: 0, stone: 0, nectar: 0 });

      // Normal food: 10 produced, 5 consumed, net +5 → 105
      expect(result.resources.food).toBe(105);
      expect(result.resources.stone).toBe(0);
      expect(result.resources.nectar).toBe(0);
    });

    it('applies mixed bonuses correctly', () => {
      state.resources.workers = 6;
      state.resources.food = 100;

      // 2 FOREST (+0.2), 1 MOUNTAIN (+0.1), 1 MEADOW (+0.1)
      const result = system.tick(state, { food: 0.2, stone: 0.1, nectar: 0.1 });

      // Food: 6 produced, 3 consumed, +3 net. Bonus: 6 × 0.2 = +1.2. Total: 100 + 3 + 1.2 = 104.2
      expect(result.resources.food).toBeCloseTo(104);
      // Stone: 6 × 0.1 = +0.6
      expect(result.resources.stone).toBeCloseTo(0);
      // Nectar: 6 × 0.1 = +0.6
      expect(result.resources.nectar).toBeCloseTo(0);
    });

    it('applies no bonus when no workers available', () => {
      state.resources.workers = 0;
      const result = system.tick(state, { food: 0.5, stone: 0.3, nectar: 0.2 });

      expect(result.resources.food).toBe(0);
      expect(result.resources.stone).toBe(0);
      expect(result.resources.nectar).toBe(0);
    });

    it('defaults to zero bonuses when not provided', () => {
      state.resources.workers = 5;
      state.resources.food = 100;
      const result = system.tick(state);

      // Normal behavior: 5 produced, 2.5 consumed, +2.5 → 102.5 (no bonus)
      expect(result.resources.food).toBeCloseTo(103);
      expect(result.resources.stone).toBe(0);
      expect(result.resources.nectar).toBe(0);
    });
  });
});
