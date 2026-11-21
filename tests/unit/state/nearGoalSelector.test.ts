import { afterEach, describe, expect, it } from 'vitest';
import { gameState } from '../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase } from '../../../src/phases/phases';
import { EGG_TO_COLONY, goalPercent } from '../../../src/phases/transitions';
import { selectNearGoalPhase } from '../../../src/state/selectors';
import { narrativeBalance } from '../../../src/data/balance/narrative';

/** Story 4.9: the near-goal beat is due once goal progress reaches the threshold in data/balance/. */
describe('selectNearGoalPhase (Story 4.9)', () => {
  const initial = gameState.value;
  afterEach(() => {
    gameState.value = initial;
  });

  const withWorkers = (workers: number): GameState => {
    const s = createInitialState();
    return { ...s, phase: Phase.EGG_LAYING, resources: { ...s.resources, workers } };
  };

  it('is null below the threshold and the phase from the threshold on', () => {
    const target = EGG_TO_COLONY.conditions[0].target(createInitialState());
    let first = -1;
    for (let w = 0; w <= target; w++) {
      if (goalPercent(EGG_TO_COLONY, withWorkers(w)) >= narrativeBalance.nearGoalPercent) {
        first = w;
        break;
      }
    }
    expect(first).toBeGreaterThan(0);
    gameState.value = withWorkers(first - 1);
    expect(selectNearGoalPhase.value).toBeNull();
    gameState.value = withWorkers(first);
    expect(selectNearGoalPhase.value).toBe(Phase.EGG_LAYING);
    gameState.value = withWorkers(target);
    expect(selectNearGoalPhase.value).toBe(Phase.EGG_LAYING);
  });

  it('is null after the last phase (no goal)', () => {
    gameState.value = { ...createInitialState(), phase: Phase.TRANSCENDENCE };
    expect(selectNearGoalPhase.value).toBeNull();
  });
});
