import type { GameState } from '../state/GameState';
import type { EventSink } from '../engine/events';
import { Phase } from './phases';

/**
 * One condition of a phase goal (Story 1.18, AR5, ADR 0003). The goal meter
 * shows one row per condition: `<label> <current>/<target>`. Thresholds live
 * only here: the UI reads conditions through `state/selectors.ts` and never
 * restates a number.
 */
export interface GoalCondition {
  /** Stable id, named after the state field it reads (`data-condition` in the UI). */
  readonly id: string;
  /** Lowercase plural noun for the condition row, e.g. `workers`. Never names a phase. */
  readonly label: string;
  /** Singular form for the `NEXT:` line when the target is 1, e.g. `guard`. */
  readonly one?: string;
  readonly current: (state: GameState) => number;
  readonly target: (state: GameState) => number;
}

export interface Transition {
  from: Phase;
  to: Phase;
  /** Every condition of the goal; the guard is derived as all of them met. */
  readonly conditions: readonly GoalCondition[];
  guard: (state: GameState) => boolean;
  onEnter?: (state: GameState, eventBus: EventSink) => GameState;
}

/** A condition is met once its current value reaches its target. */
export function conditionMet(c: GoalCondition, state: GameState): boolean {
  return c.current(state) >= c.target(state);
}

/** Builds a transition whose guard is "every condition met", so the two can never disagree. */
function transition(def: Omit<Transition, 'guard'>): Transition {
  return { ...def, guard: (state) => def.conditions.every((c) => conditionMet(c, state)) };
}

/** Condition reading `state.resources.workers`. */
function workers(target: number): GoalCondition {
  return { id: 'workers', label: 'workers', one: 'worker', current: (s) => s.resources.workers, target: () => target };
}

/**
 * EGG_LAYING → COLONY transition.
 * Fires when the colony has 10 or more workers.
 * (Pipeline slowdown handles Phase 1 pacing; threshold unchanged.)
 */
export const EGG_TO_COLONY: Transition = transition({
  from: Phase.EGG_LAYING,
  to: Phase.COLONY,
  conditions: [workers(10)],
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.COLONY });
    return state;
  },
});
/**
 * COLONY → COMBAT transition.
 * Fires when the colony has 50+ workers and at least 1 guard assigned.
 * (Pacing nerf: was 15, now 50.)
 */
export const COLONY_TO_COMBAT: Transition = transition({
  from: Phase.COLONY,
  to: Phase.COMBAT,
  conditions: [
    workers(50),
    { id: 'guard', label: 'guards', one: 'guard', current: (s) => s.workersAssigned.guard, target: () => 1 },
  ],
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.COMBAT });
    eventBus.emit('narrative', {
      message:
        'The colony faces its first threat. Guards are posted. The age of innocence is over.',
    });
    return state;
  },
});

/**
 * COMBAT → EXPANSION transition.
 * Fires when workers >= 60 AND battlesWon >= 5.
 * (Pacing nerf: was 25/3, now 60/5.)
 * The only way into EXPANSION: every run passes through COMBAT (FR17).
 */
export const COMBAT_TO_EXPANSION: Transition = transition({
  from: Phase.COMBAT,
  to: Phase.EXPANSION,
  conditions: [
    workers(60),
    { id: 'battlesWon', label: 'battles won', one: 'battle won', current: (s) => s.battlesWon, target: () => 5 },
  ],
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.EXPANSION });
    eventBus.emit('narrative', {
      message:
        'The battles have been won. The colony has proven its strength. Now it is time to expand beyond the nest.',
    });
    return state;
  },
});

/**
 * EXPANSION → SPACE transition.
 * Fires when workers >= 80 AND food >= 5000.
 * (Pacing nerf: was 30/2000, now 80/5000.)
 * The colony has grown large enough to reach for the stars.
 */
export const EXPANSION_TO_SPACE: Transition = transition({
  from: Phase.EXPANSION,
  to: Phase.SPACE,
  conditions: [
    workers(80),
    { id: 'food', label: 'food', current: (s) => s.resources.food, target: () => 5000 },
  ],
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.SPACE });
    eventBus.emit('narrative', {
      message:
        'The colony looks to the heavens. Rockets thunder skyward. The age of space has begun.',
    });
    return state;
  },
});

/**
 * SPACE → TRANSCENDENCE transition.
 * Fires when voidCrystals >= 2000, antimatter >= 400, darkMatter >= 200.
 * Thresholds raised above capital ship build/upgrade costs so players
 * can build and upgrade ships before triggering victory.
 * The colony achieves cosmic transcendence — victory condition.
 */
export const SPACE_TO_TRANSCENDENCE: Transition = transition({
  from: Phase.SPACE,
  to: Phase.TRANSCENDENCE,
  conditions: [
    { id: 'voidCrystals', label: 'void crystals', current: (s) => s.resources.voidCrystals, target: () => 2000 },
    { id: 'antimatter', label: 'antimatter', current: (s) => s.resources.antimatter, target: () => 400 },
    { id: 'darkMatter', label: 'dark matter', current: (s) => s.resources.darkMatter, target: () => 200 },
  ],
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
});

/** All defined transitions. */
export const TRANSITIONS: Transition[] = [EGG_TO_COLONY, COLONY_TO_COMBAT, COMBAT_TO_EXPANSION, EXPANSION_TO_SPACE, SPACE_TO_TRANSCENDENCE];

/**
 * The goal of a phase: its outgoing transition (each phase has at most one,
 * FR17), or `null` after the last phase.
 */
export function goalFor(phase: Phase | string): Transition | null {
  return TRANSITIONS.find((t) => t.from === phase) ?? null;
}

/**
 * How close a goal is, as a whole percentage: the mean of each condition's
 * progress (clamped to its target), floored. 100 only when every condition is
 * met, so the condensed meter never reads 100% on an unmet goal.
 */
export function goalPercent(t: Transition, state: GameState): number {
  if (t.guard(state)) return 100;
  const ratios = t.conditions.map((c) => {
    const target = c.target(state);
    if (target <= 0) return 1;
    const now = c.current(state);
    return Number.isFinite(now) ? Math.min(1, Math.max(0, now / target)) : 0;
  });
  const mean = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
  return Math.min(99, Math.floor(mean * 100));
}
