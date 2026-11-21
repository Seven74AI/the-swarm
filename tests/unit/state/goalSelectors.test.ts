import { describe, it, expect, afterEach } from 'vitest';
import { effect } from '@preact/signals-core';
import { gameState } from '../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import { COLONY_TO_COMBAT, goalFor } from '../../../src/phases/transitions';
import {
  selectGoal,
  selectGoalPercent,
  selectConditionCurrent,
  selectConditionTarget,
  selectConditionMet,
} from '../../../src/state/selectors';

/** Story 1.18: the goal meter reads the phase layer's conditions through selectors (ADR 0001). */
describe('goal selectors (Story 1.18)', () => {
  const initial = gameState.value;
  afterEach(() => {
    gameState.value = initial;
  });

  const colony = (patch: (s: GameState) => GameState = (s) => s): GameState =>
    patch({ ...createInitialState(), phase: Phase.COLONY });

  it('selectGoal follows the phase and is null after the last phase', () => {
    for (const phase of PHASE_ORDER) {
      gameState.value = { ...createInitialState(), phase };
      expect(selectGoal.value).toBe(goalFor(phase));
    }
    gameState.value = { ...createInitialState(), phase: Phase.TRANSCENDENCE };
    expect(selectGoal.value).toBeNull();
  });

  it('condition values are whole numbers read from the condition, and met follows the condition', () => {
    const [workers, guard] = COLONY_TO_COMBAT.conditions;
    gameState.value = colony((s) => ({
      ...s,
      resources: { ...s.resources, workers: workers.target(s) },
      workersAssigned: { ...s.workersAssigned, guard: 0 },
    }));
    expect(selectConditionCurrent(workers).value).toBe(workers.target(gameState.value));
    expect(selectConditionTarget(workers).value).toBe(workers.target(gameState.value));
    expect(selectConditionMet(workers).value).toBe(true);
    expect(selectConditionMet(guard).value).toBe(false);
    expect(selectGoalPercent.value).toBeLessThan(100);
    expect(selectGoalPercent.value).toBeGreaterThan(0);
  });

  it('floors a fractional current value', () => {
    const food = goalFor(Phase.EXPANSION)!.conditions.find((c) => c.id === 'food')!;
    gameState.value = {
      ...createInitialState(),
      phase: Phase.EXPANSION,
      resources: { ...createInitialState().resources, food: 12.75 },
    };
    expect(Number.isInteger(selectConditionCurrent(food).value)).toBe(true);
    expect(selectConditionCurrent(food).value).toBe(Math.floor(12.75));
  });

  it('caches one selector per condition', () => {
    const [workers] = COLONY_TO_COMBAT.conditions;
    expect(selectConditionCurrent(workers)).toBe(selectConditionCurrent(workers));
    expect(selectConditionMet(workers)).toBe(selectConditionMet(workers));
  });

  it('stays quiet on a write that changes no goal number', () => {
    gameState.value = colony();
    let runs = 0;
    const stop = effect(() => {
      void selectGoal.value;
      void selectGoalPercent.value;
      runs++;
    });
    const before = runs;
    gameState.value = { ...gameState.value, stats: { ...gameState.value.stats, totalClicks: 99 } };
    expect(runs).toBe(before);
    stop();
  });
});
