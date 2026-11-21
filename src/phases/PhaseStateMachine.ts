import { TRANSITIONS, type Transition } from './transitions';
import type { GameState, PhaseGoal } from '../state/GameState';
import type { EventSink } from '../engine/events';

/**
 * The phase flow (Story 1.19, D3, ADR 0003), stateless: the phase lives in the
 * game state only.
 *
 * - `evaluate(state)` is pure and runs every tick: the transition out of the
 *   current phase whose guard holds, or null.
 * - `latch(state)` writes `state.phaseGoal` the first time `evaluate` finds a
 *   transition. The phase does not change; the goal stays met through dips.
 * - `commit(transition, state, events)` is the only code that moves the phase
 *   forward (prestige is the only other writer of `state.phase`). It runs from
 *   CONTINUE: it runs `onEnter`, clears the latch and raises `phase_committed`.
 */
export class PhaseStateMachine {
  private readonly transitions: readonly Transition[];

  constructor(transitions: readonly Transition[] = TRANSITIONS) {
    this.transitions = transitions;
  }

  /** The transition out of the current phase whose guard is met now, or null. Pure. */
  evaluate(state: GameState): Transition | null {
    for (const t of this.transitions) {
      if (t.from === state.phase && t.guard(state)) return t;
    }
    return null;
  }

  /**
   * Latch the goal when it is first met. Returns the same reference when there
   * is nothing to write (already latched, or not met), so a tick writes it once.
   */
  latch(state: GameState): GameState {
    if (this.pending(state)) return state;
    const t = this.evaluate(state);
    if (!t) return state;
    const goal: PhaseGoal = { phase: t.to, latched: true, atMs: state.stats.playTimeMs, reached: reachedValues(t, state) };
    return { ...state, phaseGoal: goal };
  }

  /** The transition CONTINUE commits: the one the latch points at, out of the current phase. */
  pending(state: GameState): Transition | null {
    const goal = state.phaseGoal;
    if (!goal?.latched) return null;
    return this.transitions.find((t) => t.from === state.phase && t.to === goal.phase) ?? null;
  }

  /** Enter `transition.to`: run `onEnter`, clear the latch, raise `phase_committed`. */
  commit(transition: Transition, state: GameState, events: EventSink): GameState {
    events.emit('phase_committed', { from: transition.from, to: transition.to });
    const entered = transition.onEnter ? transition.onEnter(state, events) : state;
    return { ...entered, phase: transition.to, phaseGoal: null };
  }
}

/** Each condition's value now, floored, by condition id: what the latch remembers as "reached". */
export function reachedValues(t: Transition, state: GameState): Record<string, number> {
  return Object.fromEntries(t.conditions.map((c) => [c.id, Math.floor(c.current(state))]));
}
