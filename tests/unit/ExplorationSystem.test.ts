import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  launchExploration,
  tickExplorations,
  resolveExploration,
  MAX_ACTIVE_EXPLORATIONS,
  PLANETS,
} from '../../src/systems/ExplorationSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ExplorationSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    // Ensure spaceExplorations and discoveredPlanets are initialized
    state.spaceExplorations = [];
    state.discoveredPlanets = [];
  });

  describe('launchExploration', () => {
    it('creates a space exploration to a valid planet', () => {
      const result = launchExploration(state, 'MARS');
      expect(result.spaceExplorations).toHaveLength(1);
      expect(result.spaceExplorations[0].destination).toBe('MARS');
    });

    it('sets ticksRemaining in range 40-120 for space travel', () => {
      const result = launchExploration(state, 'SATURN');
      expect(result.spaceExplorations[0].ticksRemaining).toBeGreaterThanOrEqual(40);
      expect(result.spaceExplorations[0].ticksRemaining).toBeLessThanOrEqual(120);
    });

    it('sets risk based on planet type', () => {
      const result = launchExploration(state, 'MARS');
      expect(result.spaceExplorations[0].risk).toBeGreaterThanOrEqual(0.1);
      expect(result.spaceExplorations[0].risk).toBeLessThanOrEqual(0.9);
    });

    it('returns state unchanged if max explorations reached', () => {
      for (let i = 0; i < MAX_ACTIVE_EXPLORATIONS; i++) {
        state.spaceExplorations.push({
          id: `spc_${i}`,
          destination: `planet_${i}`,
          ticksRemaining: 50,
          risk: 0.3,
        });
      }
      const result = launchExploration(state, 'MARS');
      expect(result).toBe(state);
    });

    it('generates unique IDs for each exploration', () => {
      const result1 = launchExploration(state, 'MARS');
      const result2 = launchExploration(result1, 'SATURN');
      expect(result2.spaceExplorations).toHaveLength(2);
      expect(result2.spaceExplorations[0].id).not.toBe(result2.spaceExplorations[1].id);
    });

    it('adds planet to discoveredPlanets on first visit', () => {
      const result = launchExploration(state, 'MARS');
      expect(result.discoveredPlanets).toContain('MARS');
    });

    it('does not duplicate planet in discoveredPlanets', () => {
      state.discoveredPlanets = ['MARS'];
      const result = launchExploration(state, 'MARS');
      expect(result.discoveredPlanets).toEqual(['MARS']);
    });
  });

  describe('tickExplorations', () => {
    it('decrements all exploration timers by 1', () => {
      state.spaceExplorations = [
        { id: 'e1', destination: 'MARS', ticksRemaining: 60, risk: 0.3 },
        { id: 'e2', destination: 'SATURN', ticksRemaining: 80, risk: 0.2 },
      ];
      const result = tickExplorations(state);
      expect(result.spaceExplorations[0].ticksRemaining).toBe(59);
      expect(result.spaceExplorations[1].ticksRemaining).toBe(79);
    });

    it('returns same state if no explorations', () => {
      const result = tickExplorations(state);
      expect(result.spaceExplorations).toEqual([]);
    });
  });

  describe('resolveExploration', () => {
    it('on success, adds voidCrystals from ice planets', () => {
      const exp = { id: 'e1', destination: 'EUROPA', ticksRemaining: 1, risk: 0.01 };
      state.spaceExplorations = [exp];
      state.resources.voidCrystals = 0;
      state.resources.antimatter = 0;
      state.resources.darkMatter = 0;

      const result = resolveExploration(state, exp);
      expect(result.spaceExplorations).toHaveLength(0);
      // EUROPA is ice -> voidCrystals reward
      expect(result.resources.voidCrystals).toBeGreaterThan(0);
    });

    it('on success, adds antimatter from rocky planets', () => {
      const exp = { id: 'e1', destination: 'MARS', ticksRemaining: 1, risk: 0.01 };
      state.spaceExplorations = [exp];
      state.resources.voidCrystals = 0;
      state.resources.antimatter = 0;
      state.resources.darkMatter = 0;

      const result = resolveExploration(state, exp);
      // MARS is rocky -> antimatter reward
      expect(result.resources.antimatter).toBeGreaterThan(0);
    });

    it('on success, adds darkMatter from gas planets', () => {
      const exp = { id: 'e1', destination: 'SATURN', ticksRemaining: 1, risk: 0.01 };
      state.spaceExplorations = [exp];
      state.resources.voidCrystals = 0;
      state.resources.antimatter = 0;
      state.resources.darkMatter = 0;

      const result = resolveExploration(state, exp);
      // SATURN is gas -> darkMatter reward
      expect(result.resources.darkMatter).toBeGreaterThan(0);
    });

    it('on success, adds food and voidCrystals from habitable planets', () => {
      const exp = { id: 'e1', destination: 'KEPLER-442B', ticksRemaining: 1, risk: 0.01 };
      state.spaceExplorations = [exp];
      state.resources.voidCrystals = 0;
      state.resources.food = 0;

      const result = resolveExploration(state, exp);
      // HABITABLE -> food + voidCrystals
      expect(result.resources.food).toBeGreaterThan(0);
      expect(result.resources.voidCrystals).toBeGreaterThan(0);
    });

    it('high risk exploration can fail with no rewards', () => {
      const exp = { id: 'e1', destination: 'MARS', ticksRemaining: 1, risk: 0.9 };
      state.spaceExplorations = [exp];
      state.resources.voidCrystals = 0;
      state.resources.antimatter = 0;
      state.resources.darkMatter = 0;
      state.resources.food = 0;

      let failures = 0;
      let successes = 0;
      for (let i = 0; i < 20; i++) {
        const testState = {
          ...state,
          spaceExplorations: [{ ...exp, id: `exp_${i}` }],
          resources: { ...state.resources, voidCrystals: 0, antimatter: 0, darkMatter: 0, food: 0 },
        };
        const result = resolveExploration(testState, testState.spaceExplorations[0]);
        const hasLoot = result.resources.voidCrystals > 0 || result.resources.antimatter > 0 || result.resources.darkMatter > 0 || result.resources.food > 0;
        if (hasLoot) successes++;
        else failures++;
      }
      // At 0.9 risk, should have some failures
      expect(failures).toBeGreaterThan(0);
      expect(failures + successes).toBe(20);
    });

    it('returns state unchanged if exploration not found', () => {
      const exp = { id: 'nonexistent', destination: 'MARS', ticksRemaining: 1, risk: 0.5 };
      const result = resolveExploration(state, exp);
      expect(result).toBe(state);
    });

    it('partial success adds reduced rewards', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const exp = { id: 'e1', destination: 'MARS', ticksRemaining: 1, risk: 0.4 };
      state.spaceExplorations = [exp];
      state.resources.antimatter = 0;
      state.resources.food = 0;

      const result = resolveExploration(state, exp);
      // Should have some loot (partial success), but less than full
      expect(result.resources.antimatter).toBeGreaterThan(0);
      vi.restoreAllMocks();
    });

    it('space anomaly can trigger bonus resources (statistical)', () => {
      const exp = { id: 'e1', destination: 'MARS', ticksRemaining: 1, risk: 0.01 };
      state.resources.voidCrystals = 0;

      let anomalyCount = 0;
      for (let i = 0; i < 100; i++) {
        const testState = {
          ...state,
          spaceExplorations: [{ ...exp, id: `anom_${i}` }],
          resources: { ...state.resources, voidCrystals: 0, antimatter: 0, darkMatter: 0, food: 0 },
        };
        const result = resolveExploration(testState, testState.spaceExplorations[0]);
        if (result.resources.voidCrystals > 0) anomalyCount++;
      }
      // At 5% anomaly rate, expect at least 1 in 100 tries (very high probability)
      expect(anomalyCount).toBeGreaterThan(0);
    });
  });

  describe('PLANETS', () => {
    it('defines at least 4 discoverable planets', () => {
      expect(PLANETS.length).toBeGreaterThanOrEqual(4);
    });

    it('each planet has a name and type', () => {
      for (const planet of PLANETS) {
        expect(planet.name).toBeTruthy();
        expect(planet.type).toBeTruthy();
      }
    });

    it('planet types include rocky, gas, ice, habitable', () => {
      const types = PLANETS.map((p) => p.type);
      expect(types).toContain('rocky');
      expect(types).toContain('gas');
      expect(types).toContain('ice');
      expect(types).toContain('habitable');
    });
  });
});
