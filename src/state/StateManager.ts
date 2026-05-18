import type { EventBus } from '../engine/EventBus';
import { createInitialState, type GameState } from './GameState';

type StateCallback = (state: GameState) => void;

/** Recursive Partial: makes all nested properties optional */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Deep merge source into target immutably.
 * Nested objects are merged recursively; arrays and primitives are replaced.
 */
function deepMerge(target: unknown, source: unknown): unknown {
  if (
    target === null ||
    typeof target !== 'object' ||
    Array.isArray(target) ||
    source === null ||
    typeof source !== 'object' ||
    Array.isArray(source)
  ) {
    return source;
  }
  const result = { ...(target as Record<string, unknown>) };
  for (const key of Object.keys(source as Record<string, unknown>)) {
    const sv = (source as Record<string, unknown>)[key];
    const tv = (target as Record<string, unknown>)[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

export class StateManager {
  private state: GameState;
  private bus: EventBus;
  private subscribers: Set<StateCallback> = new Set();

  constructor(bus: EventBus) {
    this.bus = bus;
    this.state = createInitialState();
  }

  getState(): GameState {
    return this.state;
  }

  update(partial: DeepPartial<GameState>): GameState {
    this.state = deepMerge(this.state, partial) as GameState;
    this.bus.emit('state:changed', this.state);
    for (const cb of this.subscribers) {
      cb(this.state);
    }
    return this.state;
  }

  subscribe(callback: StateCallback): void {
    this.subscribers.add(callback);
  }
}
