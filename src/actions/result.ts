import { gameState } from '../state/gameSignal';
import type { GameState } from '../state/GameState';

/**
 * Where actions read and write the game state. The game uses the `gameState`
 * signal; tests of a single panel may pass their own.
 */
export interface StateStore {
  get(): GameState;
  set(next: GameState): void;
}

export const signalStore: StateStore = {
  get: () => gameState.peek(),
  set: (next) => {
    gameState.value = next;
  },
};

/**
 * Why an action was refused (AR16 expected outcomes). The UI turns each into
 * words; see `ui/components/refusal.ts`.
 */
export const REFUSAL_REASONS = [
  'cannot_afford',
  'no_free_workers',
  'none_assigned',
  'at_capacity',
  'slots_full',
  'locked',
  'max_level',
  'already_owned',
  'already_running',
  'not_running',
  'too_few_researchers',
  'no_soldiers',
  'not_ready',
  'not_adjacent',
  'unknown_id',
  'unavailable',
] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export interface Refused {
  readonly ok: false;
  readonly reason: RefusalReason;
}

/**
 * What an action returns. `{ ok: true }` (with `value` when the action has
 * something to report, like a battle result) or `{ ok: false, reason }`.
 * Actions never throw for an expected outcome.
 */
export type ActionResult<T = void> =
  | ([T] extends [void] ? { readonly ok: true } : { readonly ok: true; readonly value: T })
  | Refused;

export const OK: { readonly ok: true } = Object.freeze({ ok: true as const });

export function refuse(reason: RefusalReason): Refused {
  return { ok: false, reason };
}

/** The state an action validates against: the last tick's write. */
export function current(deps: { store?: StateStore }): GameState {
  return (deps.store ?? signalStore).get();
}

/**
 * Write the action's new state: the one spread write, between ticks. A system
 * that handed back the same reference refused for a reason the action didn't
 * foresee; report that instead of writing.
 */
export function commit(deps: { store?: StateStore }, before: GameState, next: GameState): { readonly ok: true } | Refused {
  if (next === before) return refuse('unavailable');
  (deps.store ?? signalStore).set(next);
  return OK;
}
