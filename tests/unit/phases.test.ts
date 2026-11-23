import { describe, it, expect } from 'vitest';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import type { Transition } from '../../src/phases/transitions';
import { EGG_TO_COLONY, COLONY_TO_COMBAT, COMBAT_TO_EXPANSION, EXPANSION_TO_SPACE, SPACE_TO_TRANSCENDENCE, TRANSITIONS } from '../../src/phases/transitions';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { createInitialState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';

/** A condition's target, read from `transitions.ts` (never restated here: Story 9.9 retuned them). */
const need = (t: Transition, id: string): number => t.conditions.find((c) => c.id === id)!.target(createInitialState());

describe('Phase enum', () => {
  it('has string values for serialization', () => {
    expect(Phase.EGG_LAYING).toBe('egg_laying');
    expect(Phase.COLONY).toBe('colony');
  });

  it('has COMBAT phase', () => {
    expect(Phase.COMBAT).toBe('combat');
  });

  it('has EXPANSION phase', () => {
    expect(Phase.EXPANSION).toBe('expansion');
  });

  it('has SPACE phase', () => {
    expect(Phase.SPACE).toBe('space');
  });

  it('has TRANSCENDENCE phase', () => {
    expect(Phase.TRANSCENDENCE).toBe('transcendence');
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

  it('has COMBAT after COLONY', () => {
    expect(PHASE_ORDER.indexOf(Phase.COLONY)).toBeLessThan(
      PHASE_ORDER.indexOf(Phase.COMBAT),
    );
  });

  it('has EXPANSION after COMBAT', () => {
    expect(PHASE_ORDER.indexOf(Phase.COMBAT)).toBeLessThan(
      PHASE_ORDER.indexOf(Phase.EXPANSION),
    );
  });

  it('has SPACE after EXPANSION', () => {
    expect(PHASE_ORDER.indexOf(Phase.EXPANSION)).toBeLessThan(
      PHASE_ORDER.indexOf(Phase.SPACE),
    );
  });

  it('has TRANSCENDENCE after SPACE', () => {
    expect(PHASE_ORDER.indexOf(Phase.SPACE)).toBeLessThan(
      PHASE_ORDER.indexOf(Phase.TRANSCENDENCE),
    );
  });

  it('contains 6 phases', () => {
    expect(PHASE_ORDER).toHaveLength(6);
  });
});

describe('Transition EGG_LAYING → COLONY', () => {
  it('has correct from/to', () => {
    expect(EGG_TO_COLONY.from).toBe(Phase.EGG_LAYING);
    expect(EGG_TO_COLONY.to).toBe(Phase.COLONY);
  });

  it('guard returns true when workers reach the target', () => {
    const state = createInitialState();
    state.resources.workers = need(EGG_TO_COLONY, 'workers');
    expect(EGG_TO_COLONY.guard(state)).toBe(true);
  });

  it('guard returns false one worker short', () => {
    const state = createInitialState();
    state.resources.workers = need(EGG_TO_COLONY, 'workers') - 1;
    expect(EGG_TO_COLONY.guard(state)).toBe(false);
  });

  it('guard returns false when workers is 0', () => {
    const state = createInitialState();
    expect(EGG_TO_COLONY.guard(state)).toBe(false);
  });

  it('committing it emits phase_committed with its from and to', () => {
    const state = { ...createInitialState(), phase: EGG_TO_COLONY.from };
    const bus = new EventBus();
    const heard: { from: Phase; to: Phase }[] = [];
    bus.subscribe('phase_committed', (p) => heard.push(p));
    new PhaseStateMachine().commit(EGG_TO_COLONY, state, bus);
    expect(heard).toEqual([{ from: EGG_TO_COLONY.from, to: EGG_TO_COLONY.to }]);
  });
});

describe('Transition COLONY → COMBAT', () => {
  it('has correct from/to', () => {
    expect(COLONY_TO_COMBAT.from).toBe(Phase.COLONY);
    expect(COLONY_TO_COMBAT.to).toBe(Phase.COMBAT);
  });

  it('guard returns false one worker short', () => {
    const state = createInitialState();
    state.resources.workers = need(COLONY_TO_COMBAT, 'workers') - 1;
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns false when guard === 0 (even with the workers)', () => {
    const state = createInitialState();
    state.resources.workers = need(COLONY_TO_COMBAT, 'workers');
    state.workersAssigned.guard = 0;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns true with the workers AND a guard', () => {
    const state = createInitialState();
    state.resources.workers = need(COLONY_TO_COMBAT, 'workers');
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(true);
  });

  it('committing it emits phase_committed with its from and to', () => {
    const state = { ...createInitialState(), phase: COLONY_TO_COMBAT.from };
    const bus = new EventBus();
    const heard: { from: Phase; to: Phase }[] = [];
    bus.subscribe('phase_committed', (p) => heard.push(p));
    new PhaseStateMachine().commit(COLONY_TO_COMBAT, state, bus);
    expect(heard).toEqual([{ from: COLONY_TO_COMBAT.from, to: COLONY_TO_COMBAT.to }]);
  });
});

describe('Transition COMBAT → EXPANSION', () => {
  it('has correct from/to', () => {
    expect(COMBAT_TO_EXPANSION.from).toBe(Phase.COMBAT);
    expect(COMBAT_TO_EXPANSION.to).toBe(Phase.EXPANSION);
  });

  it('guard returns true with the workers AND the wins', () => {
    const state = createInitialState();
    state.resources.workers = need(COMBAT_TO_EXPANSION, 'workers');
    state.battlesWon = need(COMBAT_TO_EXPANSION, 'battlesWon');
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(true);
  });

  it('guard returns false one worker short even with the wins', () => {
    const state = createInitialState();
    state.resources.workers = need(COMBAT_TO_EXPANSION, 'workers') - 1;
    state.battlesWon = need(COMBAT_TO_EXPANSION, 'battlesWon');
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('guard returns false one win short even with the workers', () => {
    const state = createInitialState();
    state.resources.workers = need(COMBAT_TO_EXPANSION, 'workers');
    state.battlesWon = need(COMBAT_TO_EXPANSION, 'battlesWon') - 1;
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('guard returns false when both conditions not met', () => {
    const state = createInitialState();
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('committing it emits phase_committed with its from and to', () => {
    const state = { ...createInitialState(), phase: COMBAT_TO_EXPANSION.from };
    const bus = new EventBus();
    const heard: { from: Phase; to: Phase }[] = [];
    bus.subscribe('phase_committed', (p) => heard.push(p));
    new PhaseStateMachine().commit(COMBAT_TO_EXPANSION, state, bus);
    expect(heard).toEqual([{ from: COMBAT_TO_EXPANSION.from, to: COMBAT_TO_EXPANSION.to }]);
  });
});

describe('Phase graph — Combat is the only way into Expansion', () => {
  it('has no transition from COLONY to EXPANSION', () => {
    const shortcut = TRANSITIONS.filter((t) => t.from === Phase.COLONY && t.to === Phase.EXPANSION);
    expect(shortcut).toHaveLength(0);
  });

  it('the only exit from COLONY leads to COMBAT', () => {
    const exits = TRANSITIONS.filter((t) => t.from === Phase.COLONY).map((t) => t.to);
    expect(exits).toEqual([Phase.COMBAT]);
  });

  it('each phase has exactly one successor, in PHASE_ORDER', () => {
    for (let i = 0; i < PHASE_ORDER.length - 1; i++) {
      const exits = TRANSITIONS.filter((t) => t.from === PHASE_ORDER[i]).map((t) => t.to);
      expect(exits, `${PHASE_ORDER[i]} should lead only to ${PHASE_ORDER[i + 1]}`).toEqual([PHASE_ORDER[i + 1]]);
    }
    const last = PHASE_ORDER[PHASE_ORDER.length - 1];
    expect(TRANSITIONS.filter((t) => t.from === last)).toHaveLength(0);
  });

  it('PHASE_ORDER is EGG_LAYING → COLONY → COMBAT → EXPANSION → SPACE → TRANSCENDENCE', () => {
    expect(PHASE_ORDER).toEqual([
      Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT, Phase.EXPANSION, Phase.SPACE, Phase.TRANSCENDENCE,
    ]);
  });

  it('a COLONY state rich in workers and food but without guards stays in COLONY', () => {
    const state = createInitialState();
    state.resources.workers = 10_000;
    state.resources.food = 10_000_000;
    state.workersAssigned.guard = 0;
    state.phase = Phase.COLONY;
    const sm = new PhaseStateMachine(TRANSITIONS);
    expect(sm.evaluate(state)).toBeNull();
  });
});

describe('Transition EXPANSION → SPACE', () => {
  it('has correct from/to', () => {
    expect(EXPANSION_TO_SPACE.from).toBe(Phase.EXPANSION);
    expect(EXPANSION_TO_SPACE.to).toBe(Phase.SPACE);
  });

  it('guard returns true with the workers AND the food', () => {
    const state = createInitialState();
    state.resources.workers = need(EXPANSION_TO_SPACE, 'workers');
    state.resources.food = need(EXPANSION_TO_SPACE, 'food');
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(true);
  });

  it('guard returns false one worker short even with the food', () => {
    const state = createInitialState();
    state.resources.workers = need(EXPANSION_TO_SPACE, 'workers') - 1;
    state.resources.food = need(EXPANSION_TO_SPACE, 'food');
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(false);
  });

  it('guard returns false short of the food even with the workers', () => {
    const state = createInitialState();
    state.resources.workers = need(EXPANSION_TO_SPACE, 'workers');
    state.resources.food = need(EXPANSION_TO_SPACE, 'food') - 1;
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(false);
  });

  it('guard returns false when both conditions not met', () => {
    const state = createInitialState();
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(false);
  });

  it('committing it emits phase_committed with its from and to', () => {
    const state = { ...createInitialState(), phase: EXPANSION_TO_SPACE.from };
    const bus = new EventBus();
    const heard: { from: Phase; to: Phase }[] = [];
    bus.subscribe('phase_committed', (p) => heard.push(p));
    new PhaseStateMachine().commit(EXPANSION_TO_SPACE, state, bus);
    expect(heard).toEqual([{ from: EXPANSION_TO_SPACE.from, to: EXPANSION_TO_SPACE.to }]);
  });
});

describe('Transition SPACE → TRANSCENDENCE', () => {
  it('has correct from/to', () => {
    expect(SPACE_TO_TRANSCENDENCE.from).toBe(Phase.SPACE);
    expect(SPACE_TO_TRANSCENDENCE.to).toBe(Phase.TRANSCENDENCE);
  });

  it('guard returns true when voidCrystals >= 2000, antimatter >= 400, darkMatter >= 200', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 2000;
    state.resources.antimatter = 400;
    state.resources.darkMatter = 200;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(true);
  });

  it('guard returns false when voidCrystals < 2000', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 1999;
    state.resources.antimatter = 400;
    state.resources.darkMatter = 200;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('guard returns false when antimatter < 400', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 2000;
    state.resources.antimatter = 399;
    state.resources.darkMatter = 200;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('guard returns false when darkMatter < 200', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 2000;
    state.resources.antimatter = 400;
    state.resources.darkMatter = 199;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('guard returns false when all resources insufficient', () => {
    const state = createInitialState();
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('committing it emits phase_committed with its from and to', () => {
    const state = { ...createInitialState(), phase: SPACE_TO_TRANSCENDENCE.from };
    const bus = new EventBus();
    const heard: { from: Phase; to: Phase }[] = [];
    bus.subscribe('phase_committed', (p) => heard.push(p));
    new PhaseStateMachine().commit(SPACE_TO_TRANSCENDENCE, state, bus);
    expect(heard).toEqual([{ from: SPACE_TO_TRANSCENDENCE.from, to: SPACE_TO_TRANSCENDENCE.to }]);
  });

  it('onEnter emits victory event', () => {
    const state = createInitialState();
    const bus = new EventBus();
    let victoryEmitted = false;
    bus.subscribe('victory', (_payload: unknown) => {
      victoryEmitted = true;
    });
    SPACE_TO_TRANSCENDENCE.onEnter!(state, bus);
    expect(victoryEmitted).toBe(true);
  });

  it('onEnter emits narrative event about transcendence', () => {
    const state = createInitialState();
    const bus = new EventBus();
    let narrativeMessage = '';
    bus.subscribe('narrative', (payload: unknown) => {
      narrativeMessage = (payload as { message: string }).message;
    });
    SPACE_TO_TRANSCENDENCE.onEnter!(state, bus);
    expect(narrativeMessage).toContain('TRANSCENDS');
  });

  it('onEnter returns state with victoryAchieved set to true', () => {
    const state = createInitialState();
    const bus = new EventBus();
    expect(state.victoryAchieved).toBe(false);
    const result = SPACE_TO_TRANSCENDENCE.onEnter!(state, bus);
    expect(result.victoryAchieved).toBe(true);
    expect(state.victoryAchieved).toBe(false); // original not mutated
  });
});
