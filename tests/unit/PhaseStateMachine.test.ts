import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { Phase } from '../../src/phases/phases';
import { TRANSITIONS } from '../../src/phases/transitions';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';

describe('PhaseStateMachine', () => {
  let fsm: PhaseStateMachine;
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    fsm = new PhaseStateMachine(Phase.EGG_LAYING, TRANSITIONS);
    state = createInitialState();
  });

  it('starts at EGG_LAYING', () => {
    expect(fsm.getCurrent()).toBe(Phase.EGG_LAYING);
  });

  it('transitions to COLONY when workers >= 10', () => {
    state.resources.workers = 10;
    const result = fsm.tick(state, bus);
    expect(result.phase).toBe(Phase.COLONY);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);
  });

  it('does NOT transition if guard fails', () => {
    state.resources.workers = 9;
    const result = fsm.tick(state, bus);
    expect(result.phase).toBe(Phase.EGG_LAYING);
    expect(fsm.getCurrent()).toBe(Phase.EGG_LAYING);
  });

  it('does NOT transition with 0 workers', () => {
    state.resources.workers = 0;
    const result = fsm.tick(state, bus);
    expect(result.phase).toBe(Phase.EGG_LAYING);
  });

  it('only fires one transition per tick', () => {
    state.resources.workers = 10;
    fsm.tick(state, bus);
    const current = fsm.getCurrent();
    expect(current).toBe(Phase.COLONY);
  });

  it('onEnter is called on transition', () => {
    state.resources.workers = 10;
    let phaseChangedPayload: string | null = null;
    bus.subscribe('phase_changed', (p: unknown) => {
      phaseChangedPayload = (p as { phase: string }).phase;
    });
    fsm.tick(state, bus);
    expect(phaseChangedPayload).toBe(Phase.COLONY);
  });

  it('emits phase_changed event on transition', () => {
    state.resources.workers = 10;
    let emitted = false;
    bus.subscribe('phase_changed', () => { emitted = true; });
    fsm.tick(state, bus);
    expect(emitted).toBe(true);
  });

  it('does NOT emit phase_changed when no transition', () => {
    state.resources.workers = 5;
    let emitted = false;
    bus.subscribe('phase_changed', () => { emitted = true; });
    fsm.tick(state, bus);
    expect(emitted).toBe(false);
  });

  it('does NOT transition backwards', () => {
    state.resources.workers = 10;
    fsm.tick(state, bus);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);

    const newState = createInitialState();
    newState.resources.workers = 10;
    const result = fsm.tick(newState, bus);
    expect(result.phase).toBe(Phase.COLONY);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);
  });

  it('stays in COLONY after transition', () => {
    state.resources.workers = 10;
    fsm.tick(state, bus);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);

    const result = fsm.tick(state, bus);
    expect(result.phase).toBe(Phase.COLONY);
  });

  it('transitions from EXPANSION to SPACE when conditions met', () => {
    state.resources.workers = 10;
    fsm.tick(state, bus);
    state.resources.workers = 50;
    state.workersAssigned.guard = 1;
    fsm.tick(state, bus);
    state.resources.workers = 40;
    state.resources.food = 1000;
    fsm.tick(state, bus);

    const fsm2 = new PhaseStateMachine(Phase.EXPANSION, TRANSITIONS);
    state.resources.workers = 80;
    state.resources.food = 5000;
    const result = fsm2.tick(state, bus);
    expect(result.phase).toBe(Phase.SPACE);
    expect(fsm2.getCurrent()).toBe(Phase.SPACE);
  });

  it('does NOT transition from EXPANSION to SPACE when conditions not met', () => {
    const fsm2 = new PhaseStateMachine(Phase.EXPANSION, TRANSITIONS);
    state.resources.workers = 79;
    state.resources.food = 4999;
    const result = fsm2.tick(state, bus);
    expect(result.phase).toBe(Phase.EXPANSION);
    expect(fsm2.getCurrent()).toBe(Phase.EXPANSION);
  });
});
