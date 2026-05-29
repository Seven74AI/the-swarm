import { describe, it, expect } from 'vitest';
import { computeResourceRates, type ResourceRates } from '../../src/systems/ResourceSystem';
import { computeOfflineResourceDeltas } from '../../src/systems/OfflineProgression';
import { createInitialState, TileType, type GameState } from '../../src/state/GameState';
import type { TerritoryBonuses } from '../../src/systems/TerritorySystem';

/**
 * Offline Resource Computation tests — behavior-focused, invariants.
 * No hardcoded formula outputs — tests that the closed-form
 * produces directionally correct results consistent with the
 * per-tick simulation model.
 */

/** Create a state with workers and gatherers for food production */
function stateWithWorkers(workers: number, gatherers: number): GameState {
  const state = createInitialState();
  state.resources.workers = workers;
  state.resources.food = 100;
  state.workersAssigned.gather = gatherers;
  return state;
}

/** Create territory bonuses with specific per-worker multipliers */
function territoryBonuses(overrides: Partial<TerritoryBonuses> = {}): TerritoryBonuses {
  return { food: 0, stone: 0, nectar: 0, wood: 0, ...overrides };
}

describe('computeResourceRates', () => {
  it('returns zero rates when no workers exist', () => {
    const state = createInitialState();
    const rates = computeResourceRates(state);
    expect(rates.foodProducedPerSec).toBe(0);
    expect(rates.foodConsumedPerSec).toBe(0);
    expect(rates.woodPerSec).toBe(0);
    expect(rates.stonePerSec).toBe(0);
    expect(rates.nectarPerSec).toBe(0);
  });

  it('food consumption is proportional to worker count', () => {
    const rates1 = computeResourceRates(stateWithWorkers(10, 10));
    const rates2 = computeResourceRates(stateWithWorkers(20, 20));
    // More workers = more consumption
    expect(rates2.foodConsumedPerSec).toBeGreaterThan(rates1.foodConsumedPerSec);
  });

  it('food production requires gatherers or unassigned workers', () => {
    // All workers assigned to non-gather roles
    const state = stateWithWorkers(10, 0);
    state.workersAssigned.tend = 10;
    const rates = computeResourceRates(state);
    // Only unassigned workers produce food — all assigned to tend = none unassigned
    // gatherCount=0, unassigned=0 → no food produced
    expect(rates.foodProducedPerSec).toBe(0);
    // But consumption still happens
    expect(rates.foodConsumedPerSec).toBeGreaterThan(0);
  });

  it('territory bonuses increase resource rates proportionally', () => {
    const state = stateWithWorkers(10, 5);
    const bon0 = territoryBonuses();
    const bon1 = territoryBonuses({ wood: 0.5, stone: 0.5 });

    const rates0 = computeResourceRates(state, bon0);
    const rates1 = computeResourceRates(state, bon1);

    // Territory bonuses should increase rates above zero-bonus baseline
    expect(rates1.woodPerSec).toBeGreaterThan(rates0.woodPerSec);
    expect(rates1.stonePerSec).toBeGreaterThan(rates0.stonePerSec);
  });

  it('rates are higher with more workers (all else equal)', () => {
    const bon = territoryBonuses({ wood: 0.5, stone: 0.5, food: 0.5, nectar: 0.5 });
    const rates5 = computeResourceRates(stateWithWorkers(5, 3), bon);
    const rates10 = computeResourceRates(stateWithWorkers(10, 6), bon);

    expect(rates10.foodProducedPerSec).toBeGreaterThan(rates5.foodProducedPerSec);
    expect(rates10.woodPerSec).toBeGreaterThan(rates5.woodPerSec);
    expect(rates10.stonePerSec).toBeGreaterThan(rates5.stonePerSec);
  });

  it('rates are pure — same state → same rates', () => {
    const state = stateWithWorkers(10, 5);
    const r1 = computeResourceRates(state);
    const r2 = computeResourceRates(state);
    expect(r1).toEqual(r2);
  });
});

describe('computeOfflineResourceDeltas', () => {
  it('returns zero deltas for zero offline time', () => {
    const state = stateWithWorkers(10, 5);
    const deltas = computeOfflineResourceDeltas(state, 0);
    expect(deltas.foodDelta).toBe(0);
    expect(deltas.woodDelta).toBe(0);
    expect(deltas.stoneDelta).toBe(0);
    expect(deltas.nectarDelta).toBe(0);
    expect(deltas.grossFoodProduced).toBe(0);
  });

  it('returns zero deltas for negative offline time', () => {
    const state = stateWithWorkers(10, 5);
    const deltas = computeOfflineResourceDeltas(state, -100);
    expect(deltas.foodDelta).toBe(0);
  });

  it('food delta grows proportionally with offline time', () => {
    const state = stateWithWorkers(10, 5);
    const d1 = computeOfflineResourceDeltas(state, 100);
    const d2 = computeOfflineResourceDeltas(state, 200);
    // Double the time → roughly double the delta (invariant: direction, not exact)
    expect(d2.grossFoodProduced).toBeGreaterThan(d1.grossFoodProduced);
    // Gross food produced is always non-negative
    expect(d1.grossFoodProduced).toBeGreaterThanOrEqual(0);
  });

  it('foodDelta can be negative when consumption exceeds production', () => {
    const state = stateWithWorkers(100, 0);
    state.workersAssigned.tend = 100; // all tend, no gather, no unassigned
    const deltas = computeOfflineResourceDeltas(state, 3600); // 1 hour
    // foodProducedPerSec = 0, foodConsumedPerSec > 0 → net negative
    expect(deltas.foodDelta).toBeLessThan(0);
  });

  it('territory bonuses produce wood and stone deltas', () => {
    const bon = territoryBonuses({ wood: 0.5, stone: 0.5 });
    const state = stateWithWorkers(10, 5);
    const deltas = computeOfflineResourceDeltas(state, 3600, bon);
    expect(deltas.woodDelta).toBeGreaterThan(0);
    expect(deltas.stoneDelta).toBeGreaterThan(0);
  });

  it('no territory bonuses → no wood/stone deltas', () => {
    const state = stateWithWorkers(10, 5);
    const deltas = computeOfflineResourceDeltas(state, 3600);
    expect(deltas.woodDelta).toBe(0);
    expect(deltas.stoneDelta).toBe(0);
    expect(deltas.nectarDelta).toBe(0);
  });

  it('grossFoodProduced matches food production rate × time', () => {
    const state = stateWithWorkers(10, 5);
    const rates = computeResourceRates(state);
    const totalDtSec = 1000;
    const deltas = computeOfflineResourceDeltas(state, totalDtSec);
    // Gross food produced = rate × time (floating point comparison)
    expect(deltas.grossFoodProduced).toBeCloseTo(rates.foodProducedPerSec * totalDtSec, 0);
  });

  it('closed-form resources are applied correctly to game state', () => {
    const bon = territoryBonuses({ wood: 0.5, stone: 0.5, food: 0.5, nectar: 0.5 });
    const state = stateWithWorkers(10, 5);
    const totalDtSec = 100;

    const beforeFood = state.resources.food;
    const beforeWood = state.resources.wood;
    const beforeStone = state.resources.stone;
    const beforeNectar = state.resources.nectar;

    const deltas = computeOfflineResourceDeltas(state, totalDtSec, bon);

    // Apply deltas (simulating what main.ts does)
    const after = {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food + deltas.foodDelta,
        wood: state.resources.wood + deltas.woodDelta,
        stone: state.resources.stone + deltas.stoneDelta,
        nectar: state.resources.nectar + deltas.nectarDelta,
      },
    };

    // Resources should change in the correct direction
    // Wood/stone/nectar should increase (positive production)
    expect(after.resources.wood).toBeGreaterThanOrEqual(beforeWood);
    expect(after.resources.stone).toBeGreaterThanOrEqual(beforeStone);
    expect(after.resources.nectar).toBeGreaterThanOrEqual(beforeNectar);

    // Gross food produced is always non-negative
    expect(deltas.grossFoodProduced).toBeGreaterThanOrEqual(0);
  });
});
