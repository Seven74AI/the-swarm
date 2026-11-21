import { EventQueue } from './events';

/**
 * Per-tick dependencies handed to systems (architecture: Communication
 * Patterns). Later stories add `rng` and `balance`.
 *
 * `events` collects everything raised during the tick; the game loop flushes
 * it to the bus only after `gameState.value` holds the tick's new state.
 */
export interface TickContext {
  events: EventQueue;
  dtSec: number;
}

export function createTickContext(dtSec: number): TickContext {
  return { events: new EventQueue(), dtSec };
}
