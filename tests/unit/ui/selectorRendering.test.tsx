import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { selectBuildings, selectWorkers } from '../../../src/state/selectors';

/**
 * AR1 / ADR 0004, Story 1.7: a Preact component that reads a selector
 * subscribes to that slice only. A state write that leaves the slice's value
 * alone must not re-render it, even though `gameState` itself changed.
 */

function workersOnly(s: GameState): GameState {
  return { ...s, resources: { ...s.resources, workers: s.resources.workers + 1 } };
}

function warehouseOnly(s: GameState): GameState {
  return {
    ...s,
    buildings: { ...s.buildings, warehouse: { level: s.buildings.warehouse.level + 1 } },
  };
}

function setup() {
  const renders = { workers: 0, warehouse: 0 };
  function Workers() {
    renders.workers++;
    return <span data-testid="workers">{selectWorkers.value}</span>;
  }
  function Warehouse() {
    renders.warehouse++;
    return <span data-testid="warehouse">{selectBuildings.value.warehouse.level}</span>;
  }
  const view = render(
    <div>
      <Workers />
      <Warehouse />
    </div>,
  );
  return { renders, view };
}

describe('Preact components read selector slices (Story 1.7)', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });
  afterEach(() => cleanup());

  it('re-renders only the component whose slice changed', async () => {
    const { renders, view } = setup();
    const before = { ...renders };

    await act(() => {
      gameState.value = workersOnly(gameState.value);
    });

    expect(renders.workers).toBeGreaterThan(before.workers);
    expect(renders.warehouse).toBe(before.warehouse);
    expect(view.getByTestId('workers').textContent).toBe(String(gameState.value.resources.workers));
  });

  it('leaves the other component alone when the other slice changes', async () => {
    const { renders, view } = setup();
    const before = { ...renders };

    await act(() => {
      gameState.value = warehouseOnly(gameState.value);
    });

    expect(renders.warehouse).toBeGreaterThan(before.warehouse);
    expect(renders.workers).toBe(before.workers);
    expect(view.getByTestId('warehouse').textContent).toBe(String(gameState.value.buildings.warehouse.level));
  });

  it('re-renders nothing on a write that changes neither slice', async () => {
    const { renders } = setup();
    const before = { ...renders };

    await act(() => {
      const s = gameState.value;
      gameState.value = { ...s, resources: { ...s.resources, food: s.resources.food + 1 } };
    });

    expect(renders).toEqual(before);
  });
});
