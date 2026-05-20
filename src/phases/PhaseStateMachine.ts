import type { Transition } from './transitions';
import type { GameState } from '../state/GameState';
import type { EventBus } from '../engine/EventBus';
import { Phase } from './phases';

/**
 * Finite state machine for game phase progression.
 *
 * Each tick, checks outgoing transitions from the current phase.
 * First matching guard fires the transition and calls its onEnter.
 * Only one transition per tick.
 */
export class PhaseStateMachine {
  private current: Phase;
  private transitions: Transition[];

  constructor(initial: Phase, transitions: Transition[]) {
    this.current = initial;
    this.transitions = transitions;
  }

  /**
   * Evaluate transitions from the current phase.
   * Returns the (possibly new) current phase and the (possibly modified) state.
   */
  tick(state: GameState, eventBus: EventBus): { phase: Phase; state: GameState } {
    let resultState = state;
    for (const t of this.transitions) {
      if (t.from === this.current && t.guard(state)) {
        this.current = t.to;
        if (t.onEnter) {
          resultState = t.onEnter(state, eventBus);
        }
        break; // Only one transition per tick
      }
    }
    return { phase: this.current, state: resultState };
  }

  getCurrent(): Phase {
    return this.current;
  }
}
