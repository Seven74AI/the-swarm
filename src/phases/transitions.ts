import type { GameState } from '../state/GameState';
import type { EventBus } from '../engine/EventBus';
import { Phase } from './phases';

export interface Transition {
  from: Phase;
  to: Phase;
  guard: (state: GameState) => boolean;
  onEnter?: (state: GameState, eventBus: EventBus) => void;
}

/**
 * EGG_LAYING → COLONY transition.
 * Fires when the colony has 10 or more workers.
 */
export const EGG_TO_COLONY: Transition = {
  from: Phase.EGG_LAYING,
  to: Phase.COLONY,
  guard: (state) => state.resources.workers >= 10,
  onEnter: (_state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.COLONY });
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
  onEnter: (_state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.COMBAT });
    eventBus.emit('narrative', {
      message:
        'The colony faces its first threat. Guards are posted. The age of innocence is over.',
    });
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
  onEnter: (_state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.EXPANSION });
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
  onEnter: (_state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.SPACE });
    eventBus.emit('narrative', {
      message:
        'The colony looks to the heavens. Rockets thunder skyward. The age of space has begun.',
    });
  },
};

/** All defined transitions. */
export const TRANSITIONS: Transition[] = [EGG_TO_COLONY, COLONY_TO_COMBAT, COLONY_TO_EXPANSION, EXPANSION_TO_SPACE];
