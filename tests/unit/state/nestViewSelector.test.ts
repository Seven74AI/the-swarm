import { describe, it, expect, beforeEach } from 'vitest';
import { effect } from '@preact/signals-core';
import { gameState } from '../../../src/state/gameSignal';
import { selectNestView, selectStarving } from '../../../src/state/selectors';
import { makeState } from '../helpers/makeState';

/**
 * Story 8.5 (AR14, N1): `selectNestView` is the nest scene's one input. It
 * holds whole counts from the state, and notifies only when one of them
 * changes, not on every tick.
 */
describe('selectNestView (Story 8.5)', () => {
  beforeEach(() => {
    gameState.value = makeState();
  });

  it('holds the colony as whole counts: workers, eggs and larvae', () => {
    gameState.value = makeState({ resources: { eggs: 5, larvae: 4, workers: 37 } });
    const v = selectNestView.value;
    expect([v.workers, v.eggs, v.larvae]).toEqual([37, 5, 4]);
    for (const n of [v.workers, v.eggs, v.larvae]) expect(Number.isInteger(n)).toBe(true);
  });

  it('floors fractional amounts', () => {
    gameState.value = makeState({ resources: { eggs: 5.7, larvae: 0.2, workers: 3.9 } });
    const v = selectNestView.value;
    for (const n of [v.workers, v.eggs, v.larvae]) expect(Number.isInteger(n)).toBe(true);
  });

  it('stays quiet on a write that changes no count, and notifies when one changes', () => {
    gameState.value = makeState({ resources: { eggs: 5, larvae: 4, workers: 37, food: 10 } });
    let runs = 0;
    const stop = effect(() => {
      void selectNestView.value;
      runs++;
    });
    const s = gameState.value;
    gameState.value = { ...s, resources: { ...s.resources, food: s.resources.food + 1 } };
    expect(runs).toBe(1);
    const t = gameState.value;
    gameState.value = { ...t, resources: { ...t.resources, eggs: t.resources.eggs + 1 } };
    expect(runs).toBe(2);
    expect(selectNestView.value.eggs).toBeGreaterThan(s.resources.eggs);
    stop();
  });

  it('says whether the colony is starving, by the same rule as the rest of the game (Story 8.7)', () => {
    gameState.value = makeState({ resources: { eggs: 0, larvae: 0, workers: 40, food: 1_000 } });
    expect(selectNestView.value.starving).toBe(selectStarving.value);
    expect(selectNestView.value.starving).toBe(false);
    gameState.value = makeState({
      resources: { eggs: 0, larvae: 0, workers: 40, food: 0 },
      workersAssigned: { gather: 0, tend: 40, dig: 0, guard: 0, researchers: 0 },
    });
    expect(selectStarving.value).toBe(true);
    expect(selectNestView.value.starving).toBe(true);
    expect(selectNestView.value.workers).toBe(40);
  });
});
