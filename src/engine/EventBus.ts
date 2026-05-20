/**
 * Generic event map: key = event name, value = payload type.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SwarmEvents {
  [key: string]: unknown;
}

export class EventBus<T extends Record<string, unknown> = SwarmEvents> {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  subscribe<K extends string & keyof T>(
    event: K,
    callback: (payload: T[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (payload: unknown) => void);
  }

  unsubscribe<K extends string & keyof T>(
    event: K,
    callback: (payload: T[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(callback as (payload: unknown) => void);
  }

  emit<K extends string & keyof T>(event: K, payload: T[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(payload);
        } catch (e) {
          // Error isolation: one failing callback must not prevent others
        }
      }
    }
  }
}
