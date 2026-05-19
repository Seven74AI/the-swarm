import { describe, it, expect } from 'vitest';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import type { Transition } from '../../src/phases/transitions';
import { EGG_TO_COLONY } from '../../src/phases/transitions';
import { createInitialState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';

describe('Phase enum', () => {
  it('has string values for serialization', () => {
    expect(Phase.EGG_LAYING).toBe('egg_laying');
    expect(Phase.COLONY).toBe('colony');
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

  it('contains 2 phases', () => {
    expect(PHASE_ORDER).toHaveLength(2);
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
