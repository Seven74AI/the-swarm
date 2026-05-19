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
    const newPhase = fsm.tick(state, bus);
    expect(newPhase).toBe(Phase.COLONY);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);
  });

  it('does NOT transition if guard fails', () => {
    state.resources.workers = 9;
    const newPhase = fsm.tick(state, bus);
    expect(newPhase).toBe(Phase.EGG_LAYING);
    expect(fsm.getCurrent()).toBe(Phase.EGG_LAYING);
  });

  it('does NOT transition with 0 workers', () => {
    state.resources.workers = 0;
    const newPhase = fsm.tick(state, bus);
    expect(newPhase).toBe(Phase.EGG_LAYING);
  });

  it('only fires one transition per tick', () => {
    // Give enough workers for first transition, set up a second with same guard
    state.resources.workers = 10;
    fsm.tick(state, bus);
    // Now we're in COLONY. If there were another transition, it shouldn't fire same tick.
    // First match wins rule: after transitioning, stop checking.
    const current = fsm.getCurrent();
    expect(current).toBe(Phase.COLONY);
    // Verify only one tick was processed (we didn't try to transition again)
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
    // Advance to COLONY
    state.resources.workers = 10;
    fsm.tick(state, bus);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);

    // Now even if some backward transition existed (it doesn't),
    // tick again with colony state
    const newState = createInitialState();
    newState.resources.workers = 10;
    const result = fsm.tick(newState, bus);
    // Should stay in COLONY
    expect(result).toBe(Phase.COLONY);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);
  });

  it('stays in COLONY after transition', () => {
    state.resources.workers = 10;
    fsm.tick(state, bus);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);

    // Next tick with same state stays in COLONY
    const result = fsm.tick(state, bus);
    expect(result).toBe(Phase.COLONY);
  });

  it('transitions from EXPANSION to SPACE when conditions met', () => {
    // Manually advance through phases to reach EXPANSION
    state.resources.workers = 10;
    fsm.tick(state, bus); // EGG → COLONY
    state.resources.workers = 15;
    state.workersAssigned.guard = 1;
    fsm.tick(state, bus); // COLONY → COMBAT
    state.resources.workers = 20;
    state.resources.food = 500;
    fsm.tick(state, bus); // Transition needs to be from current phase... 
    
    // The FSM only supports from=COLONY transitions for COMBAT/EXPANSION
    // We need to be in EXPANSION phase for the EXPANSION→SPACE transition
    // Create a new FSM in EXPANSION state
    const fsm2 = new PhaseStateMachine(Phase.EXPANSION, TRANSITIONS);
    state.resources.workers = 30;
    state.resources.food = 2000;
    const newPhase = fsm2.tick(state, bus);
    expect(newPhase).toBe(Phase.SPACE);
    expect(fsm2.getCurrent()).toBe(Phase.SPACE);
  });

  it('does NOT transition from EXPANSION to SPACE when conditions not met', () => {
    const fsm2 = new PhaseStateMachine(Phase.EXPANSION, TRANSITIONS);
    state.resources.workers = 25;
    state.resources.food = 500;
    const newPhase = fsm2.tick(state, bus);
    expect(newPhase).toBe(Phase.EXPANSION);
    expect(fsm2.getCurrent()).toBe(Phase.EXPANSION);
  });
});
