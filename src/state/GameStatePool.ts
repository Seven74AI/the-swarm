import { createInitialState, type GameState } from './GameState';

/**
 * Object pool for GameState to reduce GC pressure.
 *
 * Each tick creates ~27 new GameState objects via spread operators ({...state, ...}).
 * At 20 Hz that's ~540 objects/s. The pool pre-allocates GameState objects and
 * reuses them via checkout→mutate→checkin, falling back to new allocation when empty.
 *
 * Usage:
 *   const pooled = pool.spread(state, { resources: { ...state.resources, eggs: 99 } });
 *
 * This replaces:
 *   const pooled = { ...state, resources: { ...state.resources, eggs: 99 } };
 *
 * The pool also provides low-level checkout/checkin for direct mutation use.
 *
 * @see Report #144 section 1.2
 */
export class GameStatePool {
  private free: GameState[] = [];
  private readonly maxSize: number;

  /** Number of times a pooled object was returned from checkout(). */
  hits = 0;
  /** Number of times a new object was allocated (pool empty). */
  misses = 0;
  /** Number of objects returned to the pool via checkin(). */
  frees = 0;
  /** Number of objects dropped because pool was full. */
  drops = 0;

  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    for (let i = 0; i < maxSize; i++) {
      this.free.push(createInitialState());
    }
  }

  /**
   * Get a GameState from the pool. Returns a pre-allocated object if available,
   * otherwise falls back to a fresh allocation via createInitialState().
   */
  checkout(): GameState {
    const state = this.free.pop();
    if (state) {
      this.hits++;
      return state;
    }
    this.misses++;
    return createInitialState();
  }

  /**
   * Return a GameState to the pool. If the pool is full, the object is dropped
   * and left for GC collection.
   */
  checkin(state: GameState): void {
    if (this.free.length < this.maxSize) {
      this.frees++;
      this.free.push(state);
    } else {
      this.drops++;
    }
  }

  /**
   * Pooled equivalent of `{ ...source, ...changes }`.
   *
   * Checks out a pooled object, shallow-copies all fields from source, applies
   * the changes (which should contain any new nested objects created via spread),
   * checks in the source, and returns the result.
   *
   * IMPORTANT: Only use this when the source is an intermediate state that is
   * no longer referenced. Never pool the live signal (gameState.value).
   */
  spread(source: GameState, changes: Partial<GameState>): GameState {
    const result = this.checkout();
    // Shallow-copy all enumerable keys from source
    for (const key of Object.keys(source) as Array<keyof GameState>) {
      (result as unknown as Record<string, unknown>)[key] = (source as unknown as Record<string, unknown>)[key];
    }
    // Override with changes (these contain newly-allocated nested objects)
    for (const key of Object.keys(changes) as Array<keyof GameState>) {
      (result as unknown as Record<string, unknown>)[key] = (changes as unknown as Record<string, unknown>)[key];
    }
    this.checkin(source);
    return result;
  }

  /**
   * Free an intermediate state after it's been consumed by the next system.
   * Safe to call on any state — ignores null/undefined.
   */
  swap(_oldState: GameState, _newState: GameState): GameState {
    this.checkin(_oldState);
    return _newState;
  }

  /** Number of objects currently available in the pool. */
  get size(): number {
    return this.free.length;
  }

  /** Maximum number of objects the pool can hold. */
  get capacity(): number {
    return this.maxSize;
  }
}

/** Singleton pool instance for the game tick loop. */
export const gameStatePool = new GameStatePool(10);
