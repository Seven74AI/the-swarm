import { describe, it, expect, afterEach } from 'vitest';
import { effect } from '@preact/signals-core';
import { gameState } from '../../../src/state/gameSignal';
import { selectBuildAction, selectNextAction } from '../../../src/state/selectors';
import { getBuildAction, getNextAction } from '../../../src/systems/NextAction';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';

/** Story 1.21: the UI reads the next action through a selector that notifies only when it changes. */
describe('selectNextAction (Story 1.21)', () => {
  const initial = gameState.value;
  afterEach(() => {
    gameState.value = initial;
  });

  const colony = (food: number) =>
    makeState({ phase: Phase.COLONY, resources: { workers: 10, food, nestCapacity: 1000 }, workersAssigned: { gather: 10 } });

  it('equals getNextAction of the current state', () => {
    gameState.value = colony(0);
    expect(selectNextAction.value).toEqual(getNextAction(gameState.value));
  });

  it('keeps its reference, and stays quiet, while the suggestion is the same', () => {
    gameState.value = colony(1_000_000);
    const first = selectNextAction.value;
    expect(first.kind).toBe('act');
    let runs = 0;
    const stop = effect(() => {
      void selectNextAction.value;
      runs++;
    });
    gameState.value = { ...gameState.value, stats: { ...gameState.value.stats, playTimeMs: 1 } };
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: 1_000_001 } };
    expect(selectNextAction.value).toBe(first);
    expect(runs).toBe(1);

    gameState.value = colony(0);
    expect(selectNextAction.value).not.toBe(first);
    expect(runs).toBe(2);
    stop();
  });
});

/** Story 1.24: BUILD's highlighted card, through the same quiet selector pattern. */
describe('selectBuildAction (Story 1.24)', () => {
  const initial = gameState.value;
  afterEach(() => {
    gameState.value = initial;
  });

  const colony = (food: number) =>
    makeState({ phase: Phase.COLONY, resources: { workers: 10, food, nestCapacity: 1000 }, workersAssigned: { gather: 10 } });

  it('equals getBuildAction of the current state and stays quiet while it is the same', () => {
    gameState.value = colony(1_000_000);
    const first = selectBuildAction.value;
    expect(first).toEqual(getBuildAction(gameState.value));
    let runs = 0;
    const stop = effect(() => {
      void selectBuildAction.value;
      runs++;
    });
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: 1_000_001 } };
    expect(selectBuildAction.value).toBe(first);
    expect(runs).toBe(1);
    gameState.value = colony(0);
    expect(selectBuildAction.value).toEqual(getBuildAction(gameState.value));
    expect(runs).toBe(2);
    stop();
  });
});
