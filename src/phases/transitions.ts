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

/** All defined transitions. */
export const TRANSITIONS: Transition[] = [EGG_TO_COLONY];
