import { effect, type ReadonlySignal } from '@preact/signals-core';
import type { EventBus } from '../../engine/EventBus';
import type { SwarmEvents } from '../../engine/events';
import { getDecision } from '../../data/content/decisions';
import type { BattleOutcome, BattleResult } from '../../state/queries';
import { PHASE_TITLES } from './GoalMeter';
import type { Announcer } from './announcer';

/**
 * What the polite live region says (Story 1.32, UX-DR40): goal met, phase
 * entered, decision arrived, starving and capacity reached. The battle result
 * is announced when its summary opens (`battleLine`, from main); a costly
 * ignore and a failed save are toasts, and the toast host is itself a polite
 * status region. Nothing here listens to resource changes, so values are never
 * announced per tick: a state is announced on its false → true edge only, and
 * not again within `ANNOUNCE_COOLDOWN_MS` if it flickers at its edge.
 * A state already true at bind time is not announced (no noise at boot).
 */

/** A state that keeps crossing its edge is announced at most once in this long. */
export const ANNOUNCE_COOLDOWN_MS = 30_000;

export const GOAL_MET_LINE = 'Goal met. Continue is ready on the nest.';
export const STARVING_LINE = 'Starving: the food store is empty.';
export const CAPACITY_LINE = 'Nest capacity reached.';
/** Toasted and logged when saving starts failing (main, `SaveManager.onSaveFailed`). */
export const SAVE_FAILED_LINE = 'SAVE FAILED: STORAGE IS FULL OR BLOCKED.';
/** Told once when the save was missing and its backup was loaded instead (Story 2.2). */
export const SAVE_RECOVERED_LINE = 'THE SAVE WAS MISSING. THE BACKUP IS LOADED.';
/** A new version has installed in the background (Story 2.13): it takes over on the next cold start, never mid-session. */
export const UPDATE_READY_LINE = 'A NEW VERSION IS READY. IT LOADS THE NEXT TIME THE GAME STARTS.';
/** An import the player confirmed couldn't be written (Story 2.11): the current run stays. */
export const IMPORT_FAILED_LINE = 'IMPORT FAILED: STORAGE IS FULL OR BLOCKED. THE CURRENT RUN IS UNCHANGED.';

export interface AnnouncementDeps {
  readonly bus: Pick<EventBus<SwarmEvents>, 'subscribe' | 'unsubscribe'>;
  readonly announcer: Announcer;
  /** `selectGoalMet`. */
  readonly goalMet: ReadonlySignal<boolean>;
  /** `selectStarving`. */
  readonly starving: ReadonlySignal<boolean>;
  /** `selectCapacityReached`. */
  readonly capacityReached: ReadonlySignal<boolean>;
  /** Wall clock for the cooldown. Default `Date.now`. */
  readonly now?: () => number;
}

const OUTCOME: Record<BattleOutcome, string> = { victory: 'Battle won', defeat: 'Battle lost', draw: 'Battle drawn' };

/** The battle result in words: "Battle won against Red Ant. 2 soldiers lost." */
export function battleLine(result: Pick<BattleResult, 'outcome' | 'soldiersLost'>, enemyName: string): string {
  const lost = Math.max(0, Math.floor(result.soldiersLost));
  return `${OUTCOME[result.outcome]} against ${enemyName}. ${lost} ${lost === 1 ? 'soldier' : 'soldiers'} lost.`;
}

export function bindAnnouncements(deps: AnnouncementDeps): () => void {
  const { bus, announcer } = deps;
  const now = deps.now ?? Date.now;

  /** Announce `line` on each false → true edge of `on`, at most once per cooldown. */
  const onEdge = (on: ReadonlySignal<boolean>, line: string) => {
    let was = on.peek();
    let saidAt = -Infinity;
    return effect(() => {
      const is = on.value;
      if (is && !was && now() - saidAt > ANNOUNCE_COOLDOWN_MS) {
        saidAt = now();
        announcer.announce(line);
      }
      was = is;
    });
  };

  const onPhase = ({ to }: SwarmEvents['phase_committed']) => announcer.announce(`Phase entered: ${PHASE_TITLES[to]}.`);
  const onDecision = ({ id }: SwarmEvents['decision_spawned']) =>
    announcer.announce(`Decision: ${getDecision(id).title}.`);

  const stops = [
    onEdge(deps.goalMet, GOAL_MET_LINE),
    onEdge(deps.starving, STARVING_LINE),
    onEdge(deps.capacityReached, CAPACITY_LINE),
  ];
  bus.subscribe('phase_committed', onPhase);
  bus.subscribe('decision_spawned', onDecision);
  return () => {
    for (const s of stops) s();
    bus.unsubscribe('phase_committed', onPhase);
    bus.unsubscribe('decision_spawned', onDecision);
  };
}
