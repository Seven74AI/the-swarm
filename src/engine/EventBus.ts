/**
 * Simple seeded PRNG (mulberry32).
 * Returns a function that produces deterministic random numbers in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EventBusOptions {
  /** Optional seed for deterministic flavor selection. */
  seed?: number;
}

/** Payload shape emitted as 'narrative_event'. */
export interface NarrativeEvent<T = Record<string, unknown>> {
  type: string;
  flavor: string;
  sourceEvent: string;
  sourcePayload: T;
}

/**
 * Generic event map: key = event name, value = payload type.
 * Extend this interface to define typed events for the application.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SwarmEvents {
  [key: string]: unknown;
}

export class EventBus<T extends Record<string, unknown> = SwarmEvents> {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();
  private narrativeFlavors = new Map<string, string[]>();
  private lastFlavor = new Map<string, string>();
  private rng: () => number;

  constructor(options: EventBusOptions = {}) {
    this.rng = options.seed !== undefined ? createSeededRng(options.seed) : Math.random;
  }

  /**
   * Register narrative flavor variants for a system event.
   * When the event is emitted, a random flavor is selected and
   * emitted as {@link NarrativeEvent} on the 'narrative_event' channel.
   */
  registerFlavor(event: string, flavors: string[]): void {
    if (flavors.length === 0) return;
    this.narrativeFlavors.set(event, flavors);
  }

  subscribe<K extends string & keyof T>(
    event: K,
    callback: (payload: T[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners
      .get(event)!
      .add(callback as (payload: unknown) => void);
  }

  unsubscribe<K extends string & keyof T>(
    event: K,
    callback: (payload: T[K]) => void,
  ): void {
    this.listeners
      .get(event)
      ?.delete(callback as (payload: unknown) => void);
  }

  emit<K extends string & keyof T>(event: K, payload: T[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(payload);
        } catch (e) {
          // Error isolation: one failing callback must not prevent others.
          // Re-throw is skipped to keep the event loop resilient.
        }
      }
    }

    // Emit narrative_event alongside system events that have registered flavors
    const flavors = this.narrativeFlavors.get(event as string);
    if (flavors && flavors.length > 0) {
      const flavor = this.pickFlavor(event as string, flavors);
      const narrativePayload: NarrativeEvent = {
        type: event as string,
        flavor,
        sourceEvent: event as string,
        sourcePayload: payload as Record<string, unknown>,
      };
      this.emitNarrative(narrativePayload);
    }
  }

  /**
   * Pick a flavor variant, avoiding immediate repeats when possible.
   */
  private pickFlavor(event: string, flavors: string[]): string {
    if (flavors.length === 1) return flavors[0];

    const last = this.lastFlavor.get(event);
    // Build candidate pool — exclude the last-used flavor if there are alternatives
    const candidates = last !== undefined && flavors.length > 1
      ? flavors.filter((f) => f !== last)
      : flavors;

    const idx = Math.floor(this.rng() * candidates.length);
    const picked = candidates[idx];
    this.lastFlavor.set(event, picked);
    return picked;
  }

  /**
   * Emit a narrative event directly.
   * Public to allow manual narrative_event emission for testing.
   */
  private emitNarrative(payload: NarrativeEvent): void {
    const callbacks = this.listeners.get('narrative_event' as string & keyof T);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(payload as unknown as T[string & keyof T]);
        } catch (e) {
          // Error isolation
        }
      }
    }
  }
}
