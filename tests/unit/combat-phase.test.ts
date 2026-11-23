import { soldierBalance } from '../../src/data/balance/soldiers';
import { describe, it, expect, beforeEach } from 'vitest';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import { COLONY_TO_COMBAT, TRANSITIONS } from '../../src/phases/transitions';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { PhaseContent } from '../../src/ui/PhaseContent';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';

/** Colony's workers target, read from transitions.ts (Story 9.9 retuned it). */
const NEED = COLONY_TO_COMBAT.conditions.find((c) => c.id === 'workers')!.target(createInitialState());

describe('Phase enum — COMBAT', () => {
  it('has COMBAT value as string', () => {
    expect(Phase.COMBAT).toBe('combat');
  });
});

describe('PHASE_ORDER — COMBAT', () => {
  it('has 6 phases', () => {
    expect(PHASE_ORDER).toHaveLength(6);
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

  it('guard returns false when one worker short', () => {
    const state = createInitialState();
    state.resources.workers = NEED - 1;
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns false when guard === 0 (even with 50+ workers)', () => {
    const state = createInitialState();
    state.resources.workers = NEED;
    state.workersAssigned.guard = 0;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns false when one worker short AND guard === 0', () => {
    const state = createInitialState();
    state.resources.workers = NEED - 1;
    state.workersAssigned.guard = 0;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns true with the workers AND guard >= 1', () => {
    const state = createInitialState();
    state.resources.workers = NEED;
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(true);
  });

  it('committing it emits phase_committed into COMBAT', () => {
    const state = { ...createInitialState(), phase: Phase.COLONY };
    const bus = new EventBus();
    const heard: Phase[] = [];
    bus.subscribe('phase_committed', ({ to }) => heard.push(to));
    new PhaseStateMachine().commit(COLONY_TO_COMBAT, state, bus);
    expect(heard).toEqual([Phase.COMBAT]);
  });
});

describe('PhaseStateMachine — COLONY → COMBAT', () => {
  let fsm: PhaseStateMachine;
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    fsm = new PhaseStateMachine([...TRANSITIONS]);
    state = { ...createInitialState(), phase: Phase.COLONY };
  });

  it('does not latch when one worker short', () => {
    state.resources.workers = NEED - 1;
    state.workersAssigned.guard = 1;
    expect(fsm.latch(state).phaseGoal).toBeNull();
  });

  it('does not latch when guard === 0', () => {
    state.resources.workers = NEED;
    state.workersAssigned.guard = 0;
    expect(fsm.latch(state).phaseGoal).toBeNull();
  });

  it('latches the COMBAT goal with the workers AND guard >= 1, without changing phase', () => {
    state.resources.workers = NEED;
    state.workersAssigned.guard = 1;
    const latched = fsm.latch(state);
    expect(latched.phase).toBe(Phase.COLONY);
    expect(latched.phaseGoal?.phase).toBe(Phase.COMBAT);
  });

  it('CONTINUE commits COMBAT once; COMBAT has its own goal', () => {
    state.resources.workers = NEED;
    state.workersAssigned.guard = 1;
    const latched = fsm.latch(state);
    const next = fsm.commit(fsm.pending(latched)!, latched, bus);
    expect(next.phase).toBe(Phase.COMBAT);
    expect(fsm.pending(next)).toBeNull();
  });
});

describe('createInitialState — combat fields', () => {
  it('initializes combatSoldiers to 0', () => {
    const state = createInitialState();
    expect(state.combatSoldiers).toBe(0);
  });

  it('initializes soldierStats with correct defaults', () => {
    const state = createInitialState();
    expect(state.soldierStats.strength).toBe(soldierBalance.baseStrength);
    expect(state.soldierStats.defense).toBe(soldierBalance.baseDefense);
    expect(state.soldierStats.speed).toBe(soldierBalance.baseSpeed);
    expect(state.soldierStats.maxHp).toBe(soldierBalance.baseMaxHp);
  });

  it('initializes equipment to zero upgrade levels', () => {
    const state = createInitialState();
    expect(state.equipment.weapon).toBe(0);
    expect(state.equipment.armor).toBe(0);
  });

  it('initializes lastBattle to null', () => {
    const state = createInitialState();
    expect(state.lastBattle).toEqual({ status: 'idle' });
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
