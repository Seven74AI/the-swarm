import { EventQueue } from './events';
import { rngStream, type RngStream } from '../utils/rng';
import { DEFAULT_SEED } from '../state/seed';

/**
 * Per-tick dependencies handed to systems (architecture: Communication
 * Patterns). `balance` comes with a later story.
 *
 * `events` collects everything raised during the tick; the game loop flushes
 * it to the bus only after `gameState.value` holds the tick's new state.
 *
 * `rng` (Story 3.1, ADR 0005) is the tick's random stream, opened on the
 * state's `rng` at the tick's start. Systems draw from it; the step folds
 * `rng.state` back into the state it returns (the tick's one write).
 */
export interface TickContext {
  events: EventQueue;
  dtSec: number;
  rng: RngStream;
}

export function createTickContext(dtSec: number, rngState: number = DEFAULT_SEED): TickContext {
  return { events: new EventQueue(), dtSec, rng: rngStream(rngState) };
}
