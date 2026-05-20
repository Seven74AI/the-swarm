import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';
import type { TerritoryBonuses } from '../../src/systems/TerritorySystem';

/**
 * ResourceSystem territory bonus tests — behavior-focused.
 */
describe('ResourceSystem territory bonuses', () => {
  let bus: EventBus;
  let system: ResourceSystem;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new ResourceSystem(bus);
    state = createInitialState();
  });

  describe('tick with territory bonuses', () => {
    it('stone bonus increases stone resources', () => {
      state.resources.workers = 5;
      const bonuses: TerritoryBonuses = { food: 0, stone: 1, nectar: 0 };

      let result = state;
      for (let i = 0; i < 3; i++) {
        result = system.tick(result, bonuses);
      }

      expect(result.resources.stone).toBeGreaterThan(0);
    });

    it('nectar bonus increases nectar resources', () => {
      state.resources.workers = 5;
      const bonuses: TerritoryBonuses = { food: 0, stone: 0, nectar: 1 };

      let result = state;
      for (let i = 0; i < 3; i++) {
        result = system.tick(result, bonuses);
      }

      expect(result.resources.nectar).toBeGreaterThan(0);
    });

    it('food bonus stacks with regular food production', () => {
      state.resources.workers = 5;
      state.resources.food = 100;
      const withoutBonus = system.tick(state);

      const bonuses: TerritoryBonuses = { food: 1, stone: 0, nectar: 0 };
      state.resources.food = 100;
      const withBonus = system.tick(state, bonuses);

      expect(withBonus.resources.food).toBeGreaterThan(withoutBonus.resources.food);
    });

    it('multiple bonuses accumulate simultaneously', () => {
      state.resources.workers = 5;
      const bonuses: TerritoryBonuses = { food: 1, stone: 1, nectar: 1 };

      let result = state;
      for (let i = 0; i < 5; i++) {
        result = system.tick(result, bonuses);
      }

      // All three should be positive after enough ticks
      expect(result.resources.food).toBeGreaterThan(0);
      expect(result.resources.stone).toBeGreaterThan(0);
      expect(result.resources.nectar).toBeGreaterThan(0);
    });

    it('zero bonuses produce no extra resources', () => {
      state.resources.workers = 5;
      const bonuses: TerritoryBonuses = { food: 0, stone: 0, nectar: 0 };

      let result = state;
      for (let i = 0; i < 3; i++) {
        result = system.tick(result, bonuses);
      }

      // Only food from workers, no stone or nectar
      expect(result.resources.stone).toBe(0);
      expect(result.resources.nectar).toBe(0);
    });

    it('no workers = no bonus production', () => {
      state.resources.workers = 0;
      const bonuses: TerritoryBonuses = { food: 1, stone: 1, nectar: 1 };
      const result = system.tick(state, bonuses);

      // No workers means bonuses don't apply
      expect(result.resources.stone).toBe(0);
      expect(result.resources.nectar).toBe(0);
    });
  });
});
