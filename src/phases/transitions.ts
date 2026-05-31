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
 * (Pipeline slowdown handles Phase 1 pacing; threshold unchanged.)
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
 * Fires when the colony has 50+ workers and at least 1 guard assigned.
 * (Pacing nerf: was 15, now 50.)
 */
export const COLONY_TO_COMBAT: Transition = {
  from: Phase.COLONY,
  to: Phase.COMBAT,
  guard: (state) => state.resources.workers >= 50 && state.workersAssigned.guard >= 1,
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
 * Fires when workers >= 60 AND battlesWon >= 5.
 * (Pacing nerf: was 25/3, now 60/5.)
 * Needed because a player who enters COMBAT before EXPANSION
 * has no way out — COLONY→EXPANSION only fires from COLONY.
 */
export const COMBAT_TO_EXPANSION: Transition = {
  from: Phase.COMBAT,
  to: Phase.EXPANSION,
  guard: (state) => state.resources.workers >= 60 && state.battlesWon >= 5,
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
 * Fires when workers >= 40 AND food >= 1000.
 * (Pacing nerf: was 20/500, now 40/1000.)
 */
export const COLONY_TO_EXPANSION: Transition = {
  from: Phase.COLONY,
  to: Phase.EXPANSION,
  guard: (state) => state.resources.workers >= 40 && state.resources.food >= 1000,
  onEnter: (state, eventBus) => {
    eventBus.emit('phase_changed', { phase: Phase.EXPANSION });
    return state;
  },
};

/**
 * EXPANSION → SPACE transition.
 * Fires when workers >= 80 AND food >= 5000.
 * (Pacing nerf: was 30/2000, now 80/5000.)
 * The colony has grown large enough to reach for the stars.
 */
export const EXPANSION_TO_SPACE: Transition = {
  from: Phase.EXPANSION,
  to: Phase.SPACE,
  guard: (state) => state.resources.workers >= 80 && state.resources.food >= 5000,
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
 * Fires when voidCrystals >= 2000, antimatter >= 400, darkMatter >= 200.
 * Thresholds raised above capital ship build/upgrade costs so players
 * can build and upgrade ships before triggering victory.
 * The colony achieves cosmic transcendence — victory condition.
 */
export const SPACE_TO_TRANSCENDENCE: Transition = {
  from: Phase.SPACE,
  to: Phase.TRANSCENDENCE,
  guard: (state) =>
    state.resources.voidCrystals >= 2000 &&
    state.resources.antimatter >= 400 &&
    state.resources.darkMatter >= 200,
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
