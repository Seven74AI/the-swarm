import { describe, it, expect } from 'vitest';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import type { Transition } from '../../src/phases/transitions';
import { EGG_TO_COLONY, COLONY_TO_EXPANSION } from '../../src/phases/transitions';
import { createInitialState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';

describe('Phase enum', () => {
  it('has string values for serialization', () => {
    expect(Phase.EGG_LAYING).toBe('egg_laying');
    expect(Phase.COLONY).toBe('colony');
  });

  it('has EXPANSION phase', () => {
    expect(Phase.EXPANSION).toBe('expansion');
  });
});

describe('PHASE_ORDER', () => {
  it('starts with EGG_LAYING', () => {
    expect(PHASE_ORDER[0]).toBe(Phase.EGG_LAYING);
  });

  it('has COLONY after EGG_LAYING', () => {
    expect(PHASE_ORDER.indexOf(Phase.EGG_LAYING)).toBeLessThan(
      PHASE_ORDER.indexOf(Phase.COLONY),
    );
  });

  it('has EXPANSION after COLONY', () => {
    expect(PHASE_ORDER.indexOf(Phase.COLONY)).toBeLessThan(
      PHASE_ORDER.indexOf(Phase.EXPANSION),
    );
  });

  it('contains 3 phases', () => {
    expect(PHASE_ORDER).toHaveLength(3);
  });
});

describe('Transition EGG_LAYING → COLONY', () => {
  it('has correct from/to', () => {
    expect(EGG_TO_COLONY.from).toBe(Phase.EGG_LAYING);
    expect(EGG_TO_COLONY.to).toBe(Phase.COLONY);
  });

  it('guard returns true when workers >= 10', () => {
    const state = createInitialState();
    state.resources.workers = 10;
    expect(EGG_TO_COLONY.guard(state)).toBe(true);
  });

  it('guard returns false when workers < 10', () => {
    const state = createInitialState();
    state.resources.workers = 9;
    expect(EGG_TO_COLONY.guard(state)).toBe(false);
  });

  it('guard returns false when workers is 0', () => {
    const state = createInitialState();
    expect(EGG_TO_COLONY.guard(state)).toBe(false);
  });

  it('onEnter emits phase_changed event', () => {
    const state = createInitialState();
    const bus = new EventBus();
    let emitted = false;
    let phasePayload: string | null = null;
    bus.subscribe('phase_changed', (payload: unknown) => {
      emitted = true;
      phasePayload = (payload as { phase: string }).phase;
    });
    EGG_TO_COLONY.onEnter!(state, bus);
    expect(emitted).toBe(true);
    expect(phasePayload).toBe(Phase.COLONY);
  });
});

describe('Transition COLONY → EXPANSION', () => {
  it('has correct from/to', () => {
    expect(COLONY_TO_EXPANSION.from).toBe(Phase.COLONY);
    expect(COLONY_TO_EXPANSION.to).toBe(Phase.EXPANSION);
  });

  it('guard returns true when workers >= 20 AND food >= 500', () => {
    const state = createInitialState();
    state.resources.workers = 20;
    state.resources.food = 500;
    expect(COLONY_TO_EXPANSION.guard(state)).toBe(true);
  });

  it('guard returns false when workers < 20 even if food >= 500', () => {
    const state = createInitialState();
    state.resources.workers = 19;
    state.resources.food = 500;
    expect(COLONY_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('guard returns false when food < 500 even if workers >= 20', () => {
    const state = createInitialState();
    state.resources.workers = 20;
    state.resources.food = 499;
    expect(COLONY_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('guard returns false when both conditions not met', () => {
    const state = createInitialState();
    expect(COLONY_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('onEnter emits phase_changed event with EXPANSION', () => {
    const state = createInitialState();
    const bus = new EventBus();
    let emitted = false;
    let phasePayload: string | null = null;
    bus.subscribe('phase_changed', (payload: unknown) => {
      emitted = true;
      phasePayload = (payload as { phase: string }).phase;
    });
    COLONY_TO_EXPANSION.onEnter!(state, bus);
    expect(emitted).toBe(true);
    expect(phasePayload).toBe(Phase.EXPANSION);
  });
});
