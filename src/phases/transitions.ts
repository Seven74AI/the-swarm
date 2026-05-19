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

/** All defined transitions. */
export const TRANSITIONS: Transition[] = [EGG_TO_COLONY, COLONY_TO_COMBAT];
