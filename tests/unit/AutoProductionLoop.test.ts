import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { tickAutoProduction } from '../../src/engine/AutoProductionLoop';

/**
 * AutoProductionLoop tests — per-tick auto egg generation.
 *
 * Covers:
 * - No eggs produced when autoProduction is disabled
 * - Correct eggs produced per tick based on autoEggRate
 * - dtSec scaling (50ms tick = 0.05s)
 * - totalEggsLaid tracking
 * - Eggs never go negative
 */
describe('AutoProductionLoop', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  it('produces zero eggs when autoProduction is disabled', () => {
    const result = tickAutoProduction(state, 1);
    expect(result.resources.eggs).toBe(state.resources.eggs);
  });

  it('produces zero eggs if enabled but no rate (no researches)', () => {
    state.autoProduction.enabled = true;
    const result = tickAutoProduction(state, 1);
    expect(result.resources.eggs).toBe(0);
  });

  it('produces correct eggs over 1 second with Basic Incubation', () => {
    state.autoProduction.enabled = true;
    state.autoProduction.researches['basic_incubation'] = true;
    // Rate = 0.5 eggs/s, dtSec = 1 → 0.5 eggs (floored? or fractional?)
    const result = tickAutoProduction(state, 1);
    // Eggs are integer — accumulate fractional progress
    expect(result.resources.eggs).toBe(0); // 0.5 accumulated, not enough for 1 egg
  });

  it('accumulates fractional progress across ticks', () => {
    state.autoProduction.enabled = true;
    state.autoProduction.researches['basic_incubation'] = true;
    // Tick 1: 0.5 accumulated → 0 eggs
    let result = tickAutoProduction(state, 1);
    expect(result.resources.eggs).toBe(0);
    // Tick 2: 0.5 + 0.5 = 1.0 → 1 egg
    result = tickAutoProduction(result, 1);
    expect(result.resources.eggs).toBe(1);
    // Tick 3: 0.0 + 0.5 = 0.5 → 0 eggs
    result = tickAutoProduction(result, 1);
    expect(result.resources.eggs).toBe(1);
    // Tick 4: 0.5 + 0.5 = 1.0 → 2 eggs
    result = tickAutoProduction(result, 1);
    expect(result.resources.eggs).toBe(2);
  });

  it('scales with dtSec (50ms tick = 0.05s)', () => {
    state.autoProduction.enabled = true;
    state.autoProduction.researches['basic_incubation'] = true;
    // Rate = 0.5 eggs/s, dtSec = 0.05 → 0.025 eggs per 50ms tick
    // Need 20 ticks to get 1 egg: 20 * 0.025 = 0.5... wait, 0.5/s means 0.025/50ms
    // After 20 ticks: 20 * 0.025 = 0.5 — still not 1
    // After 40 ticks: 40 * 0.025 = 1.0 — 1 egg
    let result = state;
    for (let i = 0; i < 39; i++) {
      result = tickAutoProduction(result, 0.05);
    }
    expect(result.resources.eggs).toBe(0); // 39 * 0.025 = 0.975
    result = tickAutoProduction(result, 0.05);
    expect(result.resources.eggs).toBe(1); // 1.0
  });

  it('increments totalEggsLaid when auto eggs are produced', () => {
    state.autoProduction.enabled = true;
    state.autoProduction.researches['basic_incubation'] = true;
    state.autoProduction.researches['queens_pheromones'] = true;
    // Rate = 2.5 eggs/s, dtSec = 2 → 5 eggs
    const result = tickAutoProduction(state, 2);
    expect(result.stats.totalEggsLaid).toBeGreaterThan(state.stats.totalEggsLaid);
    expect(result.resources.eggs).toBe(5);
    expect(result.stats.totalEggsLaid).toBe(5);
  });

  it('produces many eggs with high rate', () => {
    state.autoProduction.enabled = true;
    state.autoProduction.researches['basic_incubation'] = true;
    state.autoProduction.researches['queens_pheromones'] = true;
    state.autoProduction.researches['genetic_optimization'] = true;
    state.autoProduction.researches['cloning_vats'] = true;
    state.autoProduction.buildings['hatchery'] = 2; // ×1.4
    state.autoProduction.buildings['nursery'] = 3; // +3
    // Flat: 0.5 + 2 + 3 = 5.5
    // Mult: 1.5 * 2 * 1.4 = 4.2
    // Rate = 5.5 * 4.2 = 23.1
    const result = tickAutoProduction(state, 1);
    expect(result.resources.eggs).toBe(23);
  });

  it('does not produce when disabled even with researches', () => {
    state.autoProduction.enabled = false;
    state.autoProduction.researches['basic_incubation'] = true;
    state.autoProduction.researches['queens_pheromones'] = true;
    const result = tickAutoProduction(state, 1);
    expect(result.resources.eggs).toBe(0);
  });
});
