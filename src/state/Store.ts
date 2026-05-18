import type { StateManager } from './StateManager';
import type { GameState } from './GameState';

type SliceCallback = (value: unknown) => void;

/**
 * Provides subscribable slices of GameState.
 * Components subscribe to dot-notation paths (e.g., 'resources.eggs')
 * and are notified only when their specific slice changes.
 */
export class Store {
  private manager: StateManager;
  private subscribers = new Map<string, Set<SliceCallback>>();
  private prevValues = new Map<string, unknown>();

  constructor(manager: StateManager) {
    this.manager = manager;
    // Listen to all state changes
    manager.subscribe((state) => this.onStateChange(state));
  }

  /** Read a value from the current state by dot-notation path */
  read(path: string): unknown {
    return getByPath(this.manager.getState(), path);
  }

  /** Subscribe to changes on a specific path */
  subscribe(path: string, callback: SliceCallback): void {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
      // Seed previous value on first subscription
      this.prevValues.set(path, this.read(path));
    }
    this.subscribers.get(path)!.add(callback);
  }

  /** Unsubscribe from a path */
  unsubscribe(path: string, callback: SliceCallback): void {
    this.subscribers.get(path)?.delete(callback);
  }

  private onStateChange(state: GameState): void {
    for (const [path, callbacks] of this.subscribers) {
      const newValue = getByPath(state, path);
      const prevValue = this.prevValues.get(path);
      if (newValue !== prevValue) {
        this.prevValues.set(path, newValue);
        for (const cb of callbacks) {
          cb(newValue);
        }
      }
    }
  }
}

/**
 * Read a nested value from an object using dot-notation.
 */
function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
