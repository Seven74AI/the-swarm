import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { throttleSignal } from '../../../../src/ui/primitives/throttledSignal';
import { sceneBalance } from '../../../../src/data/balance/scene';

/**
 * Story 8.5 (AR14, D11): the scene reads its view at most 4 times a second.
 * Invariants: updates are at least one refresh period apart, the period
 * allows no more than 4 a second, and the latest value always arrives.
 */
describe('throttleSignal (Story 8.5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refreshes at most 4 times a second', () => {
    expect(sceneBalance.viewRefreshMs * 4).toBeGreaterThanOrEqual(1000);
  });

  it('publishes changes no closer than one refresh period, and ends on the latest value', () => {
    const source = signal(0);
    const t = throttleSignal(source, sceneBalance.viewRefreshMs);
    const at: number[] = [];
    let last = t.value.value;
    const step = 10;
    for (let ms = 0; ms < 2000; ms += step) {
      source.value = source.value + 1;
      vi.advanceTimersByTime(step);
      if (t.value.value !== last) {
        last = t.value.value;
        at.push(ms);
      }
    }
    expect(at.length).toBeGreaterThan(1);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(sceneBalance.viewRefreshMs - step);
    // A second change per period at most: 2 s of changes give no more than 2 × 4 (+ the first).
    expect(at.length).toBeLessThanOrEqual(2 * 4 + 1);
    vi.advanceTimersByTime(sceneBalance.viewRefreshMs);
    expect(t.value.value).toBe(source.value);
    t.dispose();
  });

  it('shows a lone change at once, and nothing after dispose', () => {
    const source = signal('a');
    const t = throttleSignal(source, sceneBalance.viewRefreshMs);
    source.value = 'b';
    expect(t.value.value).toBe('b');
    t.dispose();
    vi.advanceTimersByTime(sceneBalance.viewRefreshMs);
    source.value = 'c';
    vi.advanceTimersByTime(sceneBalance.viewRefreshMs);
    expect(t.value.value).toBe('b');
  });
});
