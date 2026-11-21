import { describe, it, expect, beforeEach, vi } from 'vitest';
import { effect } from '@preact/signals-core';
import { gameState } from '../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../src/state/GameState';
import * as selectors from '../../src/state/selectors';
import { getEffects } from '../../src/systems/BuildingSystem';
import { StarmapPanel } from '../../src/ui/panels/StarmapPanel';
import { EventBus } from '../../src/engine/EventBus';

/** One tick that changes only food: a new state and a new resources object, every other slice kept. */
function foodOnlyTick(s: GameState): GameState {
  return { ...s, resources: { ...s.resources, food: s.resources.food + 1 } };
}

/** Count how many times an effect reading `read()` runs (the first run included). */
function countRuns(read: () => unknown): { runs: () => number; dispose: () => void } {
  let n = 0;
  const dispose = effect(() => {
    read();
    n++;
  });
  return { runs: () => n, dispose };
}

describe('state selectors (#186)', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });

  it('exports only computed slices named select<Noun>', () => {
    const entries = Object.entries(selectors);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, value] of entries) {
      if (typeof value === 'function') {
        // Selector factories (parameterised slices) are allowed, but still named select<Noun>.
        expect(name).toMatch(/^select[A-Z]/);
        continue;
      }
      expect(name).toMatch(/^select[A-Z]/);
      expect(value).toHaveProperty('peek');
      expect(value).toHaveProperty('value');
    }
  });

  it('a food-only tick does not notify the buildings selector', () => {
    const buildings = countRuns(() => selectors.selectBuildings.value);
    const before = buildings.runs();
    gameState.value = foodOnlyTick(gameState.value);
    gameState.value = foodOnlyTick(gameState.value);
    expect(buildings.runs()).toBe(before);
    buildings.dispose();
  });

  it('a food-only tick does notify the resources selector', () => {
    const resources = countRuns(() => selectors.selectResources.value);
    const before = resources.runs();
    gameState.value = foodOnlyTick(gameState.value);
    expect(resources.runs()).toBeGreaterThan(before);
    resources.dispose();
  });

  it('a food-only tick leaves every slice outside resources silent', () => {
    const watched = Object.entries(selectors).filter(
      ([name, v]) => typeof v !== 'function' && !/Resources|Food|Path/.test(name),
    ) as Array<[string, { value: unknown }]>;
    const counters = watched.map(([name, sel]) => [name, countRuns(() => sel.value)] as const);
    const before = counters.map(([, c]) => c.runs());
    gameState.value = foodOnlyTick(gameState.value);
    const noisy = counters.filter(([, c], i) => c.runs() !== before[i]).map(([name]) => name);
    // Derived slices of resources (counts, capacity) compare by value, so they stay quiet too.
    expect(noisy).toEqual([]);
    for (const [, c] of counters) c.dispose();
  });

  it('a derived number slice notifies only when its value changes', () => {
    const cap = countRuns(() => selectors.selectEffectiveNestCapacity.value);
    const before = cap.runs();
    gameState.value = foodOnlyTick(gameState.value);
    expect(cap.runs()).toBe(before);
    const s = gameState.value;
    gameState.value = { ...s, resources: { ...s.resources, nestCapacity: s.resources.nestCapacity + 1 } };
    expect(cap.runs()).toBeGreaterThan(before);
    cap.dispose();
  });

  it('effective nest capacity adds the warehouse bonus to the base capacity', () => {
    const s = gameState.value;
    gameState.value = { ...s, buildings: { ...s.buildings, warehouse: { level: 1 } } };
    const g = gameState.value;
    expect(selectors.selectEffectiveNestCapacity.value).toBe(
      g.resources.nestCapacity + (getEffects('warehouse', 1).nestCapacity ?? 0),
    );
  });

  it('selectGoalMet follows the phase goal latch, quiet on ticks that keep it', () => {
    expect(selectors.selectGoalMet.value).toBe(false);
    const s = gameState.value;
    gameState.value = { ...s, phaseGoal: { phase: 'colony', latched: true, atMs: 0, reached: {} } };
    expect(selectors.selectGoalMet.value).toBe(true);
    const c = countRuns(() => selectors.selectGoalMet.value);
    gameState.value = foodOnlyTick(gameState.value);
    expect(c.runs()).toBe(1);
    c.dispose();
  });

  it('selectByPath reads a nested number and ignores unrelated writes', () => {
    const food = selectors.selectByPath('resources.food');
    expect(food.value).toBe(gameState.value.resources.food);
    const runs = countRuns(() => food.value);
    const before = runs.runs();
    const s = gameState.value;
    gameState.value = { ...s, stats: { ...s.stats, playTimeMs: s.stats.playTimeMs + 50 } };
    expect(runs.runs()).toBe(before);
    gameState.value = foodOnlyTick(gameState.value);
    expect(runs.runs()).toBeGreaterThan(before);
    runs.dispose();
  });
});

describe('UI effects depend on selectors, not on the whole state', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });

  it('a panel that shows no food does not re-render on a food-only tick', () => {
    const bus = new EventBus();
    // Production wiring: getState reads the live signal, which must not subscribe the panel's effect.
    const panel = new StarmapPanel(bus, () => gameState.value);
    const render = vi.spyOn(panel as unknown as { render: () => void }, 'render');
    gameState.value = foodOnlyTick(gameState.value);
    gameState.value = foodOnlyTick(gameState.value);
    expect(render).not.toHaveBeenCalled();
    const s = gameState.value;
    gameState.value = { ...s, discoveredPlanets: [...s.discoveredPlanets] };
    expect(render).toHaveBeenCalled();
  });
});
