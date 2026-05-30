import { describe, it, expect } from 'vitest';
import { Phase, PHASE_ORDER } from '../../src/phases/phases';
import type { Transition } from '../../src/phases/transitions';
import { EGG_TO_COLONY, COLONY_TO_COMBAT, COMBAT_TO_EXPANSION, COLONY_TO_EXPANSION, EXPANSION_TO_SPACE, SPACE_TO_TRANSCENDENCE } from '../../src/phases/transitions';
import { createInitialState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';

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

describe('Transition COLONY → COMBAT', () => {
  it('has correct from/to', () => {
    expect(COLONY_TO_COMBAT.from).toBe(Phase.COLONY);
    expect(COLONY_TO_COMBAT.to).toBe(Phase.COMBAT);
  });

  it('guard returns false when workers < 50', () => {
    const state = createInitialState();
    state.resources.workers = 49;
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns false when guard === 0 (even with 50+ workers)', () => {
    const state = createInitialState();
    state.resources.workers = 50;
    state.workersAssigned.guard = 0;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(false);
  });

  it('guard returns true when workers >= 50 AND guard >= 1', () => {
    const state = createInitialState();
    state.resources.workers = 50;
    state.workersAssigned.guard = 1;
    expect(COLONY_TO_COMBAT.guard(state)).toBe(true);
  });

  it('onEnter emits phase_changed event with COMBAT', () => {
    const state = createInitialState();
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

describe('Transition COMBAT → EXPANSION', () => {
  it('has correct from/to', () => {
    expect(COMBAT_TO_EXPANSION.from).toBe(Phase.COMBAT);
    expect(COMBAT_TO_EXPANSION.to).toBe(Phase.EXPANSION);
  });

  it('guard returns true when workers >= 60 AND battlesWon >= 5', () => {
    const state = createInitialState();
    state.resources.workers = 60;
    state.battlesWon = 5;
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(true);
  });

  it('guard returns false when workers < 60 even if battlesWon >= 5', () => {
    const state = createInitialState();
    state.resources.workers = 59;
    state.battlesWon = 5;
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('guard returns false when battlesWon < 5 even if workers >= 60', () => {
    const state = createInitialState();
    state.resources.workers = 60;
    state.battlesWon = 4;
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('guard returns false when both conditions not met', () => {
    const state = createInitialState();
    expect(COMBAT_TO_EXPANSION.guard(state)).toBe(false);
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
    COMBAT_TO_EXPANSION.onEnter!(state, bus);
    expect(emitted).toBe(true);
    expect(phasePayload).toBe(Phase.EXPANSION);
  });
});

describe('Transition COLONY → EXPANSION', () => {
  it('has correct from/to', () => {
    expect(COLONY_TO_EXPANSION.from).toBe(Phase.COLONY);
    expect(COLONY_TO_EXPANSION.to).toBe(Phase.EXPANSION);
  });

  it('guard returns true when workers >= 40 AND food >= 1000', () => {
    const state = createInitialState();
    state.resources.workers = 40;
    state.resources.food = 1000;
    expect(COLONY_TO_EXPANSION.guard(state)).toBe(true);
  });

  it('guard returns false when workers < 40 even if food >= 1000', () => {
    const state = createInitialState();
    state.resources.workers = 39;
    state.resources.food = 1000;
    expect(COLONY_TO_EXPANSION.guard(state)).toBe(false);
  });

  it('guard returns false when food < 1000 even if workers >= 40', () => {
    const state = createInitialState();
    state.resources.workers = 40;
    state.resources.food = 999;
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

describe('Transition EXPANSION → SPACE', () => {
  it('has correct from/to', () => {
    expect(EXPANSION_TO_SPACE.from).toBe(Phase.EXPANSION);
    expect(EXPANSION_TO_SPACE.to).toBe(Phase.SPACE);
  });

  it('guard returns true when workers >= 80 AND food >= 5000', () => {
    const state = createInitialState();
    state.resources.workers = 80;
    state.resources.food = 5000;
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(true);
  });

  it('guard returns false when workers < 80 even if food >= 5000', () => {
    const state = createInitialState();
    state.resources.workers = 79;
    state.resources.food = 5000;
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(false);
  });

  it('guard returns false when food < 5000 even if workers >= 80', () => {
    const state = createInitialState();
    state.resources.workers = 80;
    state.resources.food = 4999;
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(false);
  });

  it('guard returns false when both conditions not met', () => {
    const state = createInitialState();
    expect(EXPANSION_TO_SPACE.guard(state)).toBe(false);
  });

  it('onEnter emits phase_changed event with SPACE', () => {
    const state = createInitialState();
    const bus = new EventBus();
    let emitted = false;
    let phasePayload: string | null = null;
    bus.subscribe('phase_changed', (payload: unknown) => {
      emitted = true;
      phasePayload = (payload as { phase: string }).phase;
    });
    EXPANSION_TO_SPACE.onEnter!(state, bus);
    expect(emitted).toBe(true);
    expect(phasePayload).toBe(Phase.SPACE);
  });
});

describe('Transition SPACE → TRANSCENDENCE', () => {
  it('has correct from/to', () => {
    expect(SPACE_TO_TRANSCENDENCE.from).toBe(Phase.SPACE);
    expect(SPACE_TO_TRANSCENDENCE.to).toBe(Phase.TRANSCENDENCE);
  });

  it('guard returns true when voidCrystals >= 500, antimatter >= 100, darkMatter >= 50', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 500;
    state.resources.antimatter = 100;
    state.resources.darkMatter = 50;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(true);
  });

  it('guard returns false when voidCrystals < 500', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 499;
    state.resources.antimatter = 100;
    state.resources.darkMatter = 50;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('guard returns false when antimatter < 100', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 500;
    state.resources.antimatter = 99;
    state.resources.darkMatter = 50;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('guard returns false when darkMatter < 50', () => {
    const state = createInitialState();
    state.resources.voidCrystals = 500;
    state.resources.antimatter = 100;
    state.resources.darkMatter = 49;
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('guard returns false when all resources insufficient', () => {
    const state = createInitialState();
    expect(SPACE_TO_TRANSCENDENCE.guard(state)).toBe(false);
  });

  it('onEnter emits phase_changed event with TRANSCENDENCE', () => {
    const state = createInitialState();
    const bus = new EventBus();
    let emitted = false;
    let phasePayload: string | null = null;
    bus.subscribe('phase_changed', (payload: unknown) => {
      emitted = true;
      phasePayload = (payload as { phase: string }).phase;
    });
    SPACE_TO_TRANSCENDENCE.onEnter!(state, bus);
    expect(emitted).toBe(true);
    expect(phasePayload).toBe(Phase.TRANSCENDENCE);
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
    expect(narrativeMessage).toContain('transcend');
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
