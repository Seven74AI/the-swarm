import type { GameState } from '../state/GameState';
import type { EventBus } from '../engine/EventBus';
import { Phase } from './phases';

export interface Transition {
  from: Phase;
  to: Phase;
  guard: (state: GameState) => boolean;
  onEnter?: (state: GameState, eventBus: EventBus) => GameState;
}

/**
 * EGG_LAYING → COLONY transition.
 * Fires when the colony has 10 or more workers.
 */
export const EGG_TO_COLONY: Transition = {
  from: Phase.EGG_LAYING,
  to: Phase.COLONY,
  guard: (state) => state.resources.workers >= 10,
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.COLONY });
    return state;
  },
};
/**
 * COLONY → COMBAT transition.
 * Fires when the colony has 15+ workers and at least 1 guard assigned.
 */
export const COLONY_TO_COMBAT: Transition = {
  from: Phase.COLONY,
  to: Phase.COMBAT,
  guard: (state) => state.resources.workers >= 15 && state.workersAssigned.guard >= 1,
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.COMBAT });
    eventBus.emit('narrative', {
      message:
        'The colony faces its first threat. Guards are posted. The age of innocence is over.',
    });
    return state;
  },
};

/**
 * COMBAT → EXPANSION transition.
 * Fires when workers >= 25 AND battlesWon >= 3.
 * Needed because a player who enters COMBAT before EXPANSION
 * has no way out — COLONY→EXPANSION only fires from COLONY.
 */
export const COMBAT_TO_EXPANSION: Transition = {
  from: Phase.COMBAT,
  to: Phase.EXPANSION,
  guard: (state) => state.resources.workers >= 25 && state.battlesWon >= 3,
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.EXPANSION });
    eventBus.emit('narrative', {
      message:
        'The battles have been won. The colony has proven its strength. Now it is time to expand beyond the nest.',
    });
    return state;
  },
};

/**
 * COLONY → EXPANSION transition.
 * Fires when workers >= 20 AND food >= 500.
 */
export const COLONY_TO_EXPANSION: Transition = {
  from: Phase.COLONY,
  to: Phase.EXPANSION,
  guard: (state) => state.resources.workers >= 20 && state.resources.food >= 500,
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.EXPANSION });
    return state;
  },
};

/**
 * EXPANSION → SPACE transition.
 * Fires when workers >= 30 AND food >= 2000.
 * The colony has grown large enough to reach for the stars.
 */
export const EXPANSION_TO_SPACE: Transition = {
  from: Phase.EXPANSION,
  to: Phase.SPACE,
  guard: (state) => state.resources.workers >= 30 && state.resources.food >= 2000,
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.SPACE });
    eventBus.emit('narrative', {
      message:
        'The colony looks to the heavens. Rockets thunder skyward. The age of space has begun.',
    });
    return state;
  },
};

/**
 * SPACE → TRANSCENDENCE transition.
 * Fires when voidCrystals >= 500, antimatter >= 100, darkMatter >= 50.
 * The colony achieves cosmic transcendence — victory condition.
 */
export const SPACE_TO_TRANSCENDENCE: Transition = {
  from: Phase.SPACE,
  to: Phase.TRANSCENDENCE,
  guard: (state) =>
    state.resources.voidCrystals >= 500 &&
    state.resources.antimatter >= 100 &&
    state.resources.darkMatter >= 50,
  onEnter: (state, eventBus) => {
    const newState = { ...state, victoryAchieved: true };
    eventBus.emit('phase_changed', { phase: Phase.TRANSCENDENCE });
    eventBus.emit('victory', {});
    eventBus.emit('narrative', {
      message:
        'The swarm collapses into a singularity of pure consciousness. Space, time, matter — all dissolve. The colony has transcended physical existence. Victory.',
    });
    return newState;
  },
};

/** All defined transitions. */
export const TRANSITIONS: Transition[] = [EGG_TO_COLONY, COLONY_TO_COMBAT, COMBAT_TO_EXPANSION, COLONY_TO_EXPANSION, EXPANSION_TO_SPACE, SPACE_TO_TRANSCENDENCE];
