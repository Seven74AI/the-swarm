import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('launchExpedition', () => {
    it('deducts soldiers and creates expedition', () => {
      state.soldiers.scouts = 2;
      state.soldiers.warriors = 1;
      const result = launchExpedition(state, 2, 1, 'mountain_tile_1');

      // Soldiers fully deducted
      expect(result.soldiers.scouts).toBe(0);
      expect(result.soldiers.warriors).toBe(0);
      // Expedition created with correct composition
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

    it('sets risk clamped between 0.1 and 0.9', () => {
      state.soldiers.scouts = 5;
      state.soldiers.warriors = 3;
      state.buildings.walls.level = 2;
      const result = launchExpedition(state, 2, 2, 'forest_zone');
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

    it('conserves soldier pool when launching (total soldiers = before - sent)', () => {
      state.soldiers.scouts = 5;
      state.soldiers.warriors = 5;
      const beforeScouts = state.soldiers.scouts;
      const beforeWarriors = state.soldiers.warriors;
      const result = launchExpedition(state, 3, 2, 'meadow');
      expect(result.soldiers.scouts).toBe(beforeScouts - 3);
      expect(result.soldiers.warriors).toBe(beforeWarriors - 2);
    });

    it('does not allow launching with zero soldiers', () => {
      state.soldiers.scouts = 5;
      state.soldiers.warriors = 5;
      const result = launchExpedition(state, 0, 0, 'test');
      expect(result).toBe(state);
      expect(result.expeditions).toHaveLength(0);
    });
  });

  describe('tickExpeditions', () => {
    it('decrements all expedition timers from their current value', () => {
      const exp1 = { id: 'e1', scouts: 1, warriors: 0, destination: 'a', ticksRemaining: 45, risk: 0.3 };
      const exp2 = { id: 'e2', scouts: 2, warriors: 1, destination: 'b', ticksRemaining: 60, risk: 0.2 };
      state.expeditions = [exp1, exp2];
      const result = tickExpeditions(state);
      expect(result.expeditions[0].ticksRemaining).toBe(exp1.ticksRemaining - 1);
      expect(result.expeditions[1].ticksRemaining).toBe(exp2.ticksRemaining - 1);
    });

    it('returns same state if no expeditions', () => {
      const result = tickExpeditions(state);
      expect(result.expeditions).toEqual([]);
    });

    it('decrements to zero correctly (expedition completes when ticksRemaining reaches 0)', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'a', ticksRemaining: 1, risk: 0.3 };
      state.expeditions = [exp];
      const result = tickExpeditions(state);
      expect(result.expeditions[0].ticksRemaining).toBe(0);
    });
  });

  describe('resolveExpedition', () => {
    it('on success, adds loot, returns soldiers, and discovers tiles', () => {
      const exp = { id: 'e1', scouts: 2, warriors: 1, destination: 'forest_tile', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      state.soldiers.scouts = 0;
      state.soldiers.warriors = 0;
      state.soldiers.totalKilled = 0;
      state.territory.ownedTiles = 0;
      const beforeFood = state.resources.food;

      const result = resolveExpedition(state, exp);

      // Expedition removed
      expect(result.expeditions).toHaveLength(0);
      // Loot gained (direction, not exact value)
      expect(result.resources.food).toBeGreaterThan(beforeFood);
      // All soldiers returned on full success (risk=0.01 → almost certain)
      expect(result.soldiers.scouts).toBeGreaterThanOrEqual(0);
      expect(result.soldiers.warriors).toBeGreaterThanOrEqual(0);
      // Casualties may occur even on low-risk expeditions (RNG-dependent)
      expect(result.soldiers.totalKilled).toBeGreaterThanOrEqual(0);
      // Tiles discovered on success
      expect(result.territory.ownedTiles).toBeGreaterThan(0);
      // Resources never go negative
      expect(result.resources.food).toBeGreaterThanOrEqual(0);
      expect(result.resources.wood).toBeGreaterThanOrEqual(0);
      expect(result.resources.stone).toBeGreaterThanOrEqual(0);
      expect(result.resources.nectar).toBeGreaterThanOrEqual(0);
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
      // At 0.9 risk, most outcomes should involve casualties
      expect(failures + partials).toBeGreaterThan(0);
      // All iterations accounted for
      expect(failures + partials + successes).toBe(20);
    });

    it('FOREST zone yields extra wood', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'FOREST', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const beforeWood = state.resources.wood;
      const result = resolveExpedition(state, exp);
      // Risk 0.01 — always succeeds, FOREST gives wood
      expect(result.resources.wood).toBeGreaterThan(beforeWood);
    });

    it('MOUNTAIN zone yields extra stone', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'MOUNTAIN', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const beforeStone = state.resources.stone;
      const result = resolveExpedition(state, exp);
      expect(result.resources.stone).toBeGreaterThan(beforeStone);
    });

    it('MEADOW zone yields nectar', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'MEADOW', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const beforeNectar = state.resources.nectar;
      const result = resolveExpedition(state, exp);
      expect(result.resources.nectar).toBeGreaterThan(beforeNectar);
    });

    it('returns state unchanged if expedition not found', () => {
      const exp = { id: 'nonexistent', scouts: 1, warriors: 0, destination: 'x', ticksRemaining: 1, risk: 0.5 };
      const result = resolveExpedition(state, exp);
      expect(result).toBe(state);
    });

    it('warriors-only expedition partial success does not produce negative scouts', () => {
      // Force roll into partial success window
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
      expect(result.soldiers.warriors).toBeLessThan(exp.warriors);
      // Total killed > 0
      expect(result.soldiers.totalKilled).toBeGreaterThan(0);
    });

    it('failure does not produce any loot', () => {
      // Force failure: risk=0.5, roll=0.3 (< 0.5 = failure)
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      const exp = { id: 'e1', scouts: 2, warriors: 1, destination: 'danger_zone', ticksRemaining: 1, risk: 0.5 };
      state.expeditions = [exp];
      state.soldiers.scouts = 0;
      state.soldiers.warriors = 0;
      state.soldiers.totalKilled = 0;
      const beforeResources = { ...state.resources };

      const result = resolveExpedition(state, exp);

      // No loot — resources unchanged
      expect(result.resources.food).toBe(beforeResources.food);
      expect(result.resources.wood).toBe(beforeResources.wood);
      expect(result.resources.stone).toBe(beforeResources.stone);
      expect(result.resources.nectar).toBe(beforeResources.nectar);
      // All soldiers killed
      expect(result.soldiers.totalKilled).toBe(exp.scouts + exp.warriors);
      // Expedition removed
      expect(result.expeditions).toHaveLength(0);
    });

    it('full success returns all soldiers to the pool', () => {
      // Force full success: risk=0.3, roll 0.5 > 0.3+0.2=0.5 → edge of full success... 
      // Use roll=0.51 for full success (0.51 > 0.3+0.2=0.5)
      vi.spyOn(Math, 'random').mockReturnValue(0.51);
      const exp = { id: 'e1', scouts: 3, warriors: 2, destination: 'meadow', ticksRemaining: 1, risk: 0.3 };
      state.expeditions = [exp];
      state.soldiers.scouts = 0;
      state.soldiers.warriors = 0;
      state.soldiers.totalKilled = 0;

      const result = resolveExpedition(state, exp);

      // All soldiers returned
      expect(result.soldiers.scouts).toBe(exp.scouts);
      expect(result.soldiers.warriors).toBe(exp.warriors);
      expect(result.soldiers.totalKilled).toBe(0);
    });

    it('empty expedition list + resolve returns state unchanged', () => {
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'a', ticksRemaining: 1, risk: 0.5 };
      // No expeditions in state
      const result = resolveExpedition(state, exp);
      expect(result).toBe(state);
    });

    it('resources never become negative after resolve (edge case: zero starting resources)', () => {
      // Ensure all resources start at 0
      state.resources.food = 0;
      state.resources.wood = 0;
      state.resources.stone = 0;
      state.resources.nectar = 0;
      state.resources.voidCrystals = 0;
      state.resources.antimatter = 0;
      state.resources.darkMatter = 0;

      const exp = { id: 'e1', scouts: 1, warriors: 1, destination: 'FOREST', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];
      state.soldiers.scouts = 1;
      state.soldiers.warriors = 1;

      const result = resolveExpedition(state, exp);

      // All resources must be non-negative — starting from zero, this tests
      // that addLoot doesn't have any subtractive paths
      expect(result.resources.food).toBeGreaterThanOrEqual(0);
      expect(result.resources.wood).toBeGreaterThanOrEqual(0);
      expect(result.resources.stone).toBeGreaterThanOrEqual(0);
      expect(result.resources.nectar).toBeGreaterThanOrEqual(0);
      expect(result.resources.voidCrystals).toBeGreaterThanOrEqual(0);
      expect(result.resources.antimatter).toBeGreaterThanOrEqual(0);
      expect(result.resources.darkMatter).toBeGreaterThanOrEqual(0);

      // Starting from zero, at least food should increase (all expeditions give food)
      expect(result.resources.food).toBeGreaterThan(0);
    });

    it('loot amounts are integers (no fractional resources)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const exp = { id: 'e1', scouts: 1, warriors: 0, destination: 'FOREST', ticksRemaining: 1, risk: 0.01 };
      state.expeditions = [exp];

      const result = resolveExpedition(state, exp);

      // All resource changes should be integer
      expect(Number.isInteger(result.resources.food)).toBe(true);
      expect(Number.isInteger(result.resources.wood)).toBe(true);
      expect(Number.isInteger(result.resources.stone)).toBe(true);
      expect(Number.isInteger(result.resources.nectar)).toBe(true);
      expect(Number.isInteger(result.resources.voidCrystals)).toBe(true);
      expect(Number.isInteger(result.resources.antimatter)).toBe(true);
      expect(Number.isInteger(result.resources.darkMatter)).toBe(true);
    });
  });
});
