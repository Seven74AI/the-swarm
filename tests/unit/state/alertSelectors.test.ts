import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../../src/state/gameSignal';
import { selectStarving, selectCapacityReached, selectEffectiveNestCapacity } from '../../../src/state/selectors';
import { makeState } from '../helpers/makeState';

/** Story 1.32: the states the live region announces, derived from the game state. */
describe('alert selectors', () => {
  beforeEach(() => {
    gameState.value = makeState();
  });

  it('starving: the food store is empty while upkeep exceeds production', () => {
    gameState.value = makeState({
      phase: 'colony' as never,
      resources: { food: 0, workers: 40 },
      workersAssigned: { gather: 0, tend: 40, dig: 0, guard: 0, researchers: 0 },
    });
    expect(selectStarving.value).toBe(true);
  });

  it('not starving while food is in store', () => {
    gameState.value = makeState({
      phase: 'colony' as never,
      resources: { food: 500, workers: 40 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
    });
    expect(selectStarving.value).toBe(false);
  });

  it('capacity reached: the workforce fills the effective nest capacity', () => {
    gameState.value = makeState({ resources: { workers: 10, nestCapacity: 10 } });
    const cap = selectEffectiveNestCapacity.value;
    gameState.value = makeState({ resources: { workers: cap, nestCapacity: 10 } });
    expect(selectCapacityReached.value).toBe(true);
    gameState.value = makeState({ resources: { workers: cap - 1, nestCapacity: 10 } });
    expect(selectCapacityReached.value).toBe(false);
  });
});
