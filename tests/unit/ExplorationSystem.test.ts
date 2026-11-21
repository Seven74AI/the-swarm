import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { TICK_MS } from '../../src/data/constants';
import {
  launchExploration,
  tickExplorations,
  resolveExploration,
  tickProbeSwarm,
  getScaledDistance,
  MAX_ACTIVE_EXPLORATIONS,
  SURVEY_DATA_PER_EXPLORATION,
  PROBE_SWARM_THRESHOLD,
} from '../../src/systems/ExplorationSystem';
import { fixedRng } from './helpers/rng';

const TICK_SEC = TICK_MS / 1000;
/** A full-success roll (risk < 0.95 for all planets). */
const success = fixedRng(0.95);

describe('ExplorationSystem — recursive scaling', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    state.soldiers.scouts = 10;
    // Pin the outcome rolls (Story 3.1): `success` is a full success (risk < 0.95 for all planets).

  });

  describe('getScaledDistance', () => {
    it('returns shorter distances as surveyData increases (invariant)', () => {
      const dest = 'MARS';
      const d0 = getScaledDistance(dest, 0);
      const d10 = getScaledDistance(dest, 10);
      const d20 = getScaledDistance(dest, 20);

      // More surveyData → shorter distance
      expect(d10).toBeLessThan(d0);
      expect(d20).toBeLessThan(d10);
    });

    it('never goes below minimum 10 ticks', () => {
      const distance = getScaledDistance('MARS', 99999);
      expect(distance).toBeGreaterThanOrEqual(10);
    });

    it('returns same distance for same inputs (deterministic)', () => {
      const d1 = getScaledDistance('KEPLER-442B', 5);
      const d2 = getScaledDistance('KEPLER-442B', 5);
      expect(d1).toBe(d2);
    });

    it('with 0 surveyData returns base distance', () => {
      const d = getScaledDistance('MARS', 0);
      // Base distance is 40 + (hash % 81), so between 40 and 120
      expect(d).toBeGreaterThanOrEqual(40);
      expect(d).toBeLessThanOrEqual(120);
    });
  });

  describe('launchExploration', () => {
    it('starts exploration with scaled distance based on surveyData', () => {
      const d0 = launchExploration(state, 'MARS');
      expect(d0.spaceExplorations).toHaveLength(1);
      const dist0 = d0.spaceExplorations[0].remainingMs;

      // With surveyData, distance should be shorter
      const rich = { ...state, resources: { ...state.resources, surveyData: 20 } };
      const d20 = launchExploration(rich, 'MARS');
      expect(d20.spaceExplorations).toHaveLength(1);
      const dist20 = d20.spaceExplorations[0].remainingMs;

      expect(dist20).toBeLessThan(dist0);
    });

    it('caps at MAX_ACTIVE_EXPLORATIONS', () => {
      let s = state;
      for (let i = 0; i < MAX_ACTIVE_EXPLORATIONS + 2; i++) {
        s = launchExploration(s, 'MARS');
      }
      expect(s.spaceExplorations).toHaveLength(MAX_ACTIVE_EXPLORATIONS);
    });

    it('marks destination as discovered', () => {
      const result = launchExploration(state, 'SATURN');
      expect(result.discoveredPlanets).toContain('SATURN');
    });
  });

  describe('resolveExploration — surveyData gain', () => {
    it('grants surveyData on full success', () => {
      // 0.95 triggers full success (above all risk values)
      const launched = launchExploration(state, 'MARS');
      const exp = launched.spaceExplorations[0];
      // Tick it down to completion
      let ticked = launched;
      for (let i = 0; i < exp.remainingMs; i++) {
        ticked = tickExplorations(ticked, 0.05);
      }
      const resolved = resolveExploration(ticked, { ...ticked.spaceExplorations[0], status: 'running' as const, remainingMs: 0, durationMs: 0 }, success);
      expect(resolved.resources.surveyData).toBeGreaterThanOrEqual(1);
    });

    it('grants more surveyData from multiple successful explorations (invariant)', () => {
      let s = state;
      // Launch and resolve 3 explorations
      for (let j = 0; j < 3; j++) {
        s = launchExploration(s, 'MARS');
        const exp = s.spaceExplorations[0];
        for (let i = 0; i < exp.remainingMs; i++) {
          s = tickExplorations(s, 0.05);
        }
        s = resolveExploration(s, { ...s.spaceExplorations[0], status: 'running' as const, remainingMs: 0, durationMs: 0 }, success);
      }
      // At least 3 surveyData from 3 full successes
      expect(s.resources.surveyData).toBeGreaterThanOrEqual(3);
    });

    it('does not grant surveyData on failure', () => {
      // 0.1 < risk for all planets → failure
      const launched = launchExploration(state, 'MARS');
      const exp = launched.spaceExplorations[0];
      let ticked = launched;
      for (let i = 0; i < exp.remainingMs; i++) {
        ticked = tickExplorations(ticked, 0.05);
      }

      const resolved = resolveExploration(ticked, { ...ticked.spaceExplorations[0], status: 'running' as const, remainingMs: 0, durationMs: 0 }, fixedRng(0.1));
      expect(resolved.resources.surveyData).toBe(0);
    });
  });

  describe('tickProbeSwarm', () => {
    it('does nothing when surveyData below threshold', () => {
      const belowThreshold = { ...state, resources: { ...state.resources, surveyData: PROBE_SWARM_THRESHOLD - 1 } };
      const result = tickProbeSwarm(belowThreshold, TICK_SEC);
      expect(result.spaceExplorations).toHaveLength(0);
    });

    it('does nothing when at max active explorations', () => {
      const rich = { ...state, resources: { ...state.resources, surveyData: PROBE_SWARM_THRESHOLD } };
      // Fill all slots
      let filled = rich;
      for (let i = 0; i < MAX_ACTIVE_EXPLORATIONS; i++) {
        filled = launchExploration(filled, 'MARS');
      }

      const result = tickProbeSwarm(filled, TICK_SEC);
      // Should not add more (already at max)
      expect(result.spaceExplorations).toHaveLength(MAX_ACTIVE_EXPLORATIONS);
    });

    it('auto-launches when above threshold and slots available', () => {
      const rich = { ...state, resources: { ...state.resources, surveyData: PROBE_SWARM_THRESHOLD } };
      // A per-tick chance: over a long step (400 ticks) a launch is all but certain.
      const result = tickProbeSwarm(rich, 400 * TICK_SEC);
      expect(result.spaceExplorations.length).toBeGreaterThanOrEqual(1);
    });

    it('launches are fixed by the seed and the game tick (Story 3.1): one tick sometimes launches, sometimes not', () => {
      const outcomes = new Set<number>();
      for (let seed = 0; seed < 200; seed++) {
        const rich = { ...state, seed, resources: { ...state.resources, surveyData: PROBE_SWARM_THRESHOLD } };
        const n = tickProbeSwarm(rich, TICK_SEC).spaceExplorations.length;
        expect(tickProbeSwarm(rich, TICK_SEC).spaceExplorations.length).toBe(n);
        outcomes.add(n);
      }
      expect([...outcomes].sort()).toEqual([0, 1]);
    });
  });

  describe('recursive loop invariant', () => {
    it('exploring reduces future exploration distance (recursive scaling)', () => {
      // First exploration with 0 surveyData
      const first = launchExploration(state, 'EUROPA');
      const firstDist = first.spaceExplorations[0].remainingMs;

      // Simulate completing it (full success)
      let s = first;
      for (let i = 0; i < firstDist; i++) {
        s = tickExplorations(s, 0.05);
      }
      s = resolveExploration(s, { ...s.spaceExplorations[0], status: 'running' as const, remainingMs: 0, durationMs: 0 }, success);
      // surveyData should have increased
      expect(s.resources.surveyData).toBeGreaterThan(0);

      // Second exploration should be faster
      const second = launchExploration(s, 'EUROPA');
      const secondDist = second.spaceExplorations[0].remainingMs;

      expect(secondDist).toBeLessThan(firstDist);
    });
  });
});

describe('ExplorationSystem — base behavior preserved', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  it('tickExplorations decrements ticksRemaining', () => {
    const launched = launchExploration(state, 'MARS');
    const ticked = tickExplorations(launched, 0.05);
    expect(ticked.spaceExplorations[0].remainingMs)
      .toBe(launched.spaceExplorations[0].remainingMs - 50);
  });

  it('resolveExploration removes the exploration', () => {
    const launched = launchExploration(state, 'MARS');
    const exp = launched.spaceExplorations[0];
    let ticked = launched;
    for (let i = 0; i < exp.remainingMs; i++) {
      ticked = tickExplorations(ticked, 0.05);
    }
    const resolved = resolveExploration(ticked, { ...ticked.spaceExplorations[0], status: 'running' as const, remainingMs: 0, durationMs: 0 }, success);
    expect(resolved.spaceExplorations).toHaveLength(0);
  });

  it('launchExploration with no scouts still works (explorations are free)', () => {
    const noScouts = { ...state, soldiers: { ...state.soldiers, scouts: 0 } };
    const result = launchExploration(noScouts, 'MARS');
    expect(result.spaceExplorations).toHaveLength(1);
  });
});

// Clean up mocks
afterEach(() => {
  vi.restoreAllMocks();
});
