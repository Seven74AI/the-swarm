import { describe, it, expect, beforeEach } from 'vitest';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import { COLONY_TO_COMBAT, TRANSITIONS } from '../../src/phases/transitions';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { PhaseContent } from '../../src/phases/PhaseContent';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';

describe('Phase enum — COMBAT', () => {
  it('has COMBAT value as string', () => {
    expect(Phase.COMBAT).toBe('combat');
  });
});

describe('PHASE_ORDER — COMBAT', () => {
  it('has 4 phases', () => {
    expect(PHASE_ORDER).toHaveLength(4);
  });

  it('has COMBAT after COLONY', () => {
    expect(PHASE_ORDER.indexOf(Phase.EGG_LAYING))
      .toBeLessThan(PHASE_ORDER.indexOf(Phase.COLONY));
    expect(PHASE_ORDER.indexOf(Phase.COLONY))
      .toBeLessThan(PHASE_ORDER.indexOf(Phase.COMBAT));
  });
});

describe('Transition COLONY → COMBAT', () => {
  it('has correct from/to', () => {
    expect(COLONY_TO_COMBAT.from).toBe(Phase.COLONY);
    expect(COLONY_TO_COMBAT.to).toBe(Phase.COMBAT);
  });

  it('guard returns false when workers < 15', () => {
    const state = createInitialState();
    state.resources.workers = 14;
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns false when guard === 0 (even with 15+ workers)', () => {
    const state = createInitialState();
    state.resources.workers = 15;
    state.workersAssigned.guard = 0;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns false when workers < 15 AND guard === 0', () => {
    const state = createInitialState();
    state.resources.workers = 14;
    state.workersAssigned.guard = 0;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns true when workers >= 15 AND guard >= 1', () => {
    const state = createInitialState();
    state.resources.workers = 15;
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(true);
  });

  it('onEnter emits phase_changed event with COMBAT phase', () => {
    const state = createInitialState();
    state.resources.workers = 15;
    const bus = new EventBus();
    let emitted = false;
    let phasePayload: string | null = null;
    bus.subscribe('phase_changed', (payload: unknown) => {
      emitted = true;
      phasePayload = (payload as { phase: string }).phase;
    });
    COLONY_TO_COMBAT.onEnter!(state, bus);
    expect(emitted).toBe(true);
    expect(phasePayload).toBe(Phase.COMBAT);
  });
});

describe('PhaseStateMachine — COLONY → COMBAT', () => {
  let fsm: PhaseStateMachine;
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    // Start in COLONY so we can test COLONY→COMBAT
    fsm = new PhaseStateMachine(Phase.COLONY, [...TRANSITIONS]);
    state = createInitialState();
  });

  it('does NOT transition when workers < 15', () => {
    state.resources.workers = 14;
    state.workersAssigned.guard = 1;
    const newPhase = fsm.tick(state, bus);
    expect(newPhase).toBe(Phase.COLONY);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);
  });

  it('does NOT transition when guard === 0', () => {
    state.resources.workers = 15;
    state.workersAssigned.guard = 0;
    const newPhase = fsm.tick(state, bus);
    expect(newPhase).toBe(Phase.COLONY);
    expect(fsm.getCurrent()).toBe(Phase.COLONY);
  });

  it('transitions to COMBAT when workers >= 15 AND guard >= 1', () => {
    state.resources.workers = 15;
    state.workersAssigned.guard = 1;
    const newPhase = fsm.tick(state, bus);
    expect(newPhase).toBe(Phase.COMBAT);
    expect(fsm.getCurrent()).toBe(Phase.COMBAT);
  });

  it('only fires one transition per tick', () => {
    state.resources.workers = 15;
    state.workersAssigned.guard = 1;
    fsm.tick(state, bus);
    expect(fsm.getCurrent()).toBe(Phase.COMBAT);
    // Second tick with same state should stay in COMBAT
    const result = fsm.tick(state, bus);
    expect(result).toBe(Phase.COMBAT);
  });

  it('onEnter fires on COMBAT transition', () => {
    state.resources.workers = 15;
    state.workersAssigned.guard = 1;
    let phasePayload: string | null = null;
    bus.subscribe('phase_changed', (payload: unknown) => {
      phasePayload = (payload as { phase: string }).phase;
    });
    fsm.tick(state, bus);
    expect(phasePayload).toBe(Phase.COMBAT);
  });
});

describe('createInitialState — combat fields', () => {
  it('initializes combatSoldiers to 0', () => {
    const state = createInitialState();
    expect(state.combatSoldiers).toBe(0);
  });

  it('initializes soldierStats with correct defaults', () => {
    const state = createInitialState();
    expect(state.soldierStats.strength).toBe(1.0);
    expect(state.soldierStats.defense).toBe(1.0);
    expect(state.soldierStats.speed).toBe(5);
    expect(state.soldierStats.maxHp).toBe(10);
  });

  it('initializes equipment to zero upgrade levels', () => {
    const state = createInitialState();
    expect(state.equipment.weapon).toBe(0);
    expect(state.equipment.armor).toBe(0);
  });

  it('initializes lastBattle to null', () => {
    const state = createInitialState();
    expect(state.lastBattle).toBeNull();
  });

  it('initializes combatResources to zero', () => {
    const state = createInitialState();
    expect(state.combatResources.chitin).toBe(0);
    expect(state.combatResources.silk).toBe(0);
    expect(state.combatResources.venom).toBe(0);
  });

  it('initializes battle counters to zero', () => {
    const state = createInitialState();
    expect(state.battlesWon).toBe(0);
    expect(state.battlesLost).toBe(0);
  });
});

describe('PhaseContent — COMBAT panels', () => {
  let phaseContent: PhaseContent;

  beforeEach(() => {
    phaseContent = new PhaseContent();
  });

  it('includes soldier_panel in COMBAT phase', () => {
    const panels = phaseContent.getActivePanels(Phase.COMBAT);
    expect(panels).toContain('soldier_panel');
  });

  it('includes battle_panel in COMBAT phase', () => {
    const panels = phaseContent.getActivePanels(Phase.COMBAT);
    expect(panels).toContain('battle_panel');
  });

  it('includes combat_log in COMBAT phase', () => {
    const panels = phaseContent.getActivePanels(Phase.COMBAT);
    expect(panels).toContain('combat_log');
  });

  it('COMBAT phase includes all COLONY panels (additive)', () => {
    const colonyPanels = phaseContent.getActivePanels(Phase.COLONY);
    const combatPanels = phaseContent.getActivePanels(Phase.COMBAT);
    for (const panelId of colonyPanels) {
      expect(combatPanels).toContain(panelId);
    }
  });

  it('COMBAT phase has more panels than COLONY', () => {
    const colonyPanels = phaseContent.getActivePanels(Phase.COLONY);
    const combatPanels = phaseContent.getActivePanels(Phase.COMBAT);
    expect(combatPanels.length).toBeGreaterThan(colonyPanels.length);
  });
});
