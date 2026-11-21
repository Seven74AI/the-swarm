/**
 * Timings for the debug overlay (Story 1.34, AR24): tick time p50/p95 over the
 * newest ticks, and frames per second. Main wraps the tick's `step` in
 * `measure`; recording is two clock reads and one array write, so it stays on
 * in every build (the overlay can open in production with `?debug=1`).
 * Nothing here logs: never per tick or per frame.
 */

/** Ticks kept for the percentiles: 12 s at 20 ticks a second. */
export const TICK_SAMPLES = 240;

/** The p-th percentile (nearest rank) of `samples`, or null for none. Doesn't reorder `samples`. */
export function percentile(samples: readonly number[], p: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export interface TickSummary {
  readonly samples: number;
  /** Milliseconds, or null before the first tick. */
  readonly p50: number | null;
  readonly p95: number | null;
}

export interface TickTimings {
  record(ms: number): void;
  /** Run `fn`, record how long it took (even if it throws), return its result. */
  measure<T>(fn: () => T): T;
  summary(): TickSummary;
}

const defaultNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createTickTimings(now: () => number = defaultNow): TickTimings {
  const ring: number[] = [];
  let next = 0;
  const record = (ms: number): void => {
    if (ring.length < TICK_SAMPLES) ring.push(ms);
    else ring[next] = ms;
    next = (next + 1) % TICK_SAMPLES;
  };
  return {
    record,
    measure<T>(fn: () => T): T {
      const start = now();
      try {
        return fn();
      } finally {
        record(now() - start);
      }
    },
    summary: () => ({ samples: ring.length, p50: percentile(ring, 50), p95: percentile(ring, 95) }),
  };
}

export interface FpsMeter {
  /** Note a frame at `t` ms; returns the frames of the last second, or null until a second has passed. */
  frame(t: number): number | null;
}

export function createFpsMeter(): FpsMeter {
  const frames: number[] = [];
  let first: number | null = null;
  return {
    frame(t) {
      if (first === null) first = t;
      frames.push(t);
      while (frames.length > 0 && frames[0] <= t - 1000) frames.shift();
      return t - first >= 1000 ? frames.length : null;
    },
  };
}
