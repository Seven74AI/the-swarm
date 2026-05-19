import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  launchExpedition,
  tickExpeditions,
  resolveExpedition,
  MAX_ACTIVE_EXPEDITIONS,
} from '../../src/systems/ExpeditionSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ExpeditionSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('launchExpedition', () => {
    it('deducts soldiers and creates expedition', () => {
      state.soldiers.scouts = 2;
      state.soldiers.warriors = 1;
      const result = launchExpedition(state, 2, 1, 'mountain_tile_1');
      expect(result.soldiers.scouts).toBe(0);
      expect(result.soldiers.warriors).toBe(0);
      expect(result.expeditions).toHaveLength(1);
      expect(result.expeditions[0].scouts).toBe(2);
      expect(result.expeditions[0].warriors).toBe(1);
      expect(result.expeditions[0].destination).toBe('mountain_tile_1');
    });

    it('sets ticksRemaining in range 30-90', () => {
      state.soldiers.scouts = 1;
      state.soldiers.warriors = 1;
      const result = launchExpedition(state, 1, 1, 'meadow');
      expect(result.expeditions[0].ticksRemaining).toBeGreaterThanOrEqual(30);
      expect(result.expeditions[0].ticksRemaining).toBeLessThanOrEqual(90);
    });

    it('sets risk based on warriors and walls', () => {
      state.soldiers.scouts = 5;
      state.soldiers.warriors = 3;
      state.buildings.walls.level = 2;
      const result = launchExpedition(state, 2, 2, 'forest_zone');
      // Risk should be clamped between 0.1 and 0.9
      expect(result.expeditions[0].risk).toBeGreaterThanOrEqual(0.1);
      expect(result.expeditions[0].risk).toBeLessThanOrEqual(0.9);
    });

    it('returns state unchanged if not enough scouts', () => {
      state.soldiers.scouts = 1;
      const result = launchExpedition(state, 2, 0, 'test');
      expect(result).toBe(state);
    });

    it('returns state unchanged if not enough warriors', () => {
      state.soldiers.warriors = 0;
      const result = launchExpedition(state, 1, 2, 'test');
      expect(result).toBe(state);
    });

    it('returns state unchanged if max expeditions reached', () => {
      state.soldiers.scouts = 10;
      // Fill with max expeditions
      for (let i = 0; i < MAX_ACTIVE_EXPEDITIONS; i++) {
        state.expeditions.push({
          id: `exp_${i}`,
          scouts: 1,
          warriors: 0,
          destination: `zone_${i}`,
          ticksRemaining: 30,
          risk: 0.3,
        });
      }
      const result = launchExpedition(state, 1, 0, 'new_zone');
      expect(result).toBe(state);
    });

    it('allows scouts-only expedition (no warriors)', () => {
      state.soldiers.scouts = 1;
      const result = launchExpedition(state, 1, 0, 'meadow');
      expect(result.expeditions).toHaveLength(1);
      expect(result.soldiers.scouts).toBe(0);
    });

    it('generates unique IDs for each expedition', () => {
      state.soldiers.scouts = 2;
      const result1 = launchExpedition(state, 1, 0, 'a');
      const result2 = launchExpedition(result1, 1, 0, 'b');
      expect(result2.expeditions).toHaveLength(2);
      expect(result2.expeditions[0].id).not.toBe(result2.expeditions[1].id);
    });
  });

  describe('tickExpeditions', () => {
    it('decrements all expedition timers by 1', () => {
      state.expeditions = [
        { id: 'e1', scouts: 1, warriors: 0, destination: 'a', ticksRemaining: 45, risk: 0.3 },
        { id: 'e2', scouts: 2, warriors: 1, destination: 'b', ticksRemaining: 60, risk: 0.2 },
      ];
      const result = tickExpeditions(state);
      expect(result.expeditions[0].ticksRemaining).toBe(44);
      expect(result.expeditions[1].ticksRemaining).toBe(59);
    });

    it('returns same state if no expeditions', () => {
      const result = tickExpeditions(state);
      expect(result.expeditions).toEqual([]);
    });
  });

  describe('resolveExpedition', () => {
    it('on success, adds loot and discovers tiles', () => {
      const exp = { id: 'e1', scouts: 2, warriors: 1, destination: 'forest_tile', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      state.soldiers.totalKilled = 0;

      const result = resolveExpedition(state, exp);
      // Should have succeeded (very low risk)
      expect(result.expeditions).toHaveLength(0);
      // Should have gained some resources
      expect(result.resources.food).toBeGreaterThan(0);
    });

    it('high risk expedition can fail with casualties', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'danger_zone', ticksRemaining: 1, risk: 0.9 };
      state.expeditions = [exp];
      state.soldiers.scouts = 0;
      state.soldiers.warriors = 0;
      state.soldiers.totalKilled = 0;
      state.resources.food = 0;

      // Run multiple times to verify failure case exists
      let failures = 0;
      let partials = 0;
      let successes = 0;
      for (let i = 0; i < 20; i++) {
        const testState = {
          ...state,
          expeditions: [{ ...exp, id: `exp_${i}` }],
          soldiers: { ...state.soldiers },
          resources: { ...state.resources, food: 0, wood: 0, stone: 0, nectar: 0 },
        };
        const result = resolveExpedition(testState, testState.expeditions[0]);
        const hasLoot = result.resources.food > 0 || result.resources.wood > 0;
        const hasKills = result.soldiers.totalKilled > 0;
        if (hasKills && !hasLoot) failures++;
        else if (hasKills && hasLoot) partials++;
        else successes++;
      }
      // At 0.9 risk, should mostly fail (some partials)
      expect(failures).toBeGreaterThan(5);
      expect(failures + partials + successes).toBe(20);
    });

    it('FOREST zone yields extra wood', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'FOREST', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      const result = resolveExpedition(state, exp);
      // Very low risk (0.01) — should always succeed
      expect(result.resources.wood).toBeGreaterThan(0);
    });

    it('MOUNTAIN zone yields extra stone', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'MOUNTAIN', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      const result = resolveExpedition(state, exp);
      expect(result.resources.stone).toBeGreaterThan(0);
    });

    it('MEADOW zone yields nectar', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'MEADOW', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      const result = resolveExpedition(state, exp);
      expect(result.resources.nectar).toBeGreaterThan(0);
    });

    it('returns state unchanged if expedition not found', () => {
      const exp = { id: 'nonexistent', scouts: 1, warriors: 0, destination: 'x', ticksRemaining: 1, risk: 0.5 };
      const result = resolveExpedition(state, exp);
      expect(result).toBe(state);
    });

    it('warriors-only expedition partial success does not produce negative scouts', () => {
      // Force roll into partial success window (0.4 = risk=0.4, partial: 0.4-0.6)
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const exp = { id: 'e1', scouts: 0, warriors: 3, destination: 'forest', ticksRemaining: 1, risk: 0.4 };
      state.expeditions = [exp];
      state.soldiers.scouts = 0;
      state.soldiers.warriors = 0;
      state.soldiers.totalKilled = 0;

      const result = resolveExpedition(state, exp);

      // Scouts must never go negative
      expect(result.soldiers.scouts).toBeGreaterThanOrEqual(0);
      // Warriors should have some casualties (proportional) but not all
      expect(result.soldiers.warriors).toBeGreaterThanOrEqual(0);
      expect(result.soldiers.warriors).toBeLessThan(exp.warriors); // some survived
      // Total killed > 0
      expect(result.soldiers.totalKilled).toBeGreaterThan(0);
      vi.restoreAllMocks();
    });
  });
});
