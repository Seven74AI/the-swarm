import { describe, expect, it } from 'vitest';
import { createFpsMeter, createTickTimings, percentile, TICK_SAMPLES } from '../../../src/debug/timings';

/** Story 1.34 (AR24): the overlay's tick time p50/p95 and FPS. */
describe('percentile', () => {
  it('is null for no samples and the sample itself for one', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([7], 95)).toBe(7);
  });

  it('p50 ≤ p95 ≤ max, and both lie within the samples', () => {
    const samples = [5, 1, 9, 3, 7, 2, 8, 4, 6, 10];
    const p50 = percentile(samples, 50)!;
    const p95 = percentile(samples, 95)!;
    expect(p50).toBeLessThanOrEqual(p95);
    expect(p95).toBeLessThanOrEqual(Math.max(...samples));
    expect(samples).toContain(p50);
    expect(samples).toContain(p95);
  });

  it('does not reorder the samples it is given', () => {
    const samples = [3, 1, 2];
    percentile(samples, 50);
    expect(samples).toEqual([3, 1, 2]);
  });
});

describe('tick timings', () => {
  it('reports nothing before the first tick', () => {
    const t = createTickTimings();
    expect(t.summary()).toEqual({ samples: 0, p50: null, p95: null });
  });

  it('keeps only the newest samples', () => {
    const t = createTickTimings();
    for (let i = 0; i < TICK_SAMPLES; i++) t.record(100);
    for (let i = 0; i < TICK_SAMPLES; i++) t.record(1);
    const s = t.summary();
    expect(s.samples).toBe(TICK_SAMPLES);
    expect(s.p95).toBe(1);
  });

  it('measures how long a step takes and returns its result', () => {
    let clock = 0;
    const t = createTickTimings(() => clock);
    const out = t.measure(() => {
      clock += 4;
      return 'next';
    });
    expect(out).toBe('next');
    expect(t.summary().p50).toBe(4);
  });

  it('records a step that throws, and rethrows', () => {
    let clock = 0;
    const t = createTickTimings(() => clock);
    expect(() =>
      t.measure(() => {
        clock += 2;
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(t.summary().samples).toBe(1);
  });
});

describe('FPS meter', () => {
  it('is null until a second of frames has been seen', () => {
    const m = createFpsMeter();
    expect(m.frame(0)).toBeNull();
    expect(m.frame(500)).toBeNull();
  });

  it('counts the frames of the last second', () => {
    const m = createFpsMeter();
    let fps: number | null = null;
    for (let t = 0; t <= 2000; t += 20) fps = m.frame(t);
    expect(fps).not.toBeNull();
    expect(Number.isInteger(fps)).toBe(true);
    // A faster stream of frames reads higher.
    const fast = createFpsMeter();
    let fastFps: number | null = null;
    for (let t = 0; t <= 2000; t += 10) fastFps = fast.frame(t);
    expect(fastFps!).toBeGreaterThan(fps!);
  });
});
