import { log } from '../utils/log';
import type { EventSink, SwarmEvents } from './events';

export type { SwarmEvents } from './events';

/**
 * Synchronous typed event bus. The event map defaults to `SwarmEvents`, so an
 * unknown event name or a wrong payload is a compile error.
 */
export class EventBus<T extends object = SwarmEvents> implements EventSink<T> {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  subscribe<K extends keyof T & string>(
    event: K,
    callback: (payload: T[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (payload: unknown) => void);
  }

  unsubscribe<K extends keyof T & string>(
    event: K,
    callback: (payload: T[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(callback as (payload: unknown) => void);
  }

  emit<K extends keyof T & string>(event: K, payload: T[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(payload);
        } catch (e) {
          // Error isolation: one failing callback must not prevent others,
          // and the failure is always logged (AR16), in every build.
          log.error('event-bus', `listener for "${event}" threw`, e);
        }
      }
    }
  }
}
