import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';
import { getOfflineCapMs, getOfflineEfficiency, planOffline } from '../../src/systems/OfflineProgression';

describe('offline efficiency is derived, not stored (Story 2.8)', () => {
  it('a new state stores no efficiency; getOfflineEfficiency gives the 50% baseline', () => {
    const state = createInitialState();
    expect('offlineEfficiency' in state).toBe(false);
    expect(getOfflineEfficiency(state)).toBe(0.5);
  });
});

describe('planOffline ticks (Story 2.4 replaced calculateOfflineTicks)', () => {
  const TICK_MS = 50; // 50ms per tick (standard game tick)
  const s = createInitialState();
  const ticksFor = (ms: number) => Math.floor(ms / TICK_MS);

  it('returns 0 ticks when no time has elapsed', () => {
    const result = planOffline(s, 0, 0.5);
    expect(result.offlineTicks).toBe(0);
    expect(result.effectiveMs).toBe(0);
  });

  it('runs efficiency × the ticks of an absence under the cap', () => {
    for (const elapsedMs of [30_000, 3_600_000]) {
      const result = planOffline(s, elapsedMs, 0.5);
      expect(result.effectiveMs).toBe(elapsedMs);
      expect(result.offlineTicks).toBe(Math.floor(ticksFor(elapsedMs) * 0.5));
    }
  });

  it('applies 75% and 100% efficiency', () => {
    expect(planOffline(s, 3_600_000, 0.75).offlineTicks).toBe(Math.floor(ticksFor(3_600_000) * 0.75));
    expect(planOffline(s, 3_600_000, 1).offlineTicks).toBe(ticksFor(3_600_000));
  });

  it('a gap past the cap runs the same ticks as the cap itself', () => {
    const cap = getOfflineCapMs(s);
    expect(planOffline(s, cap * 2, 0.5).offlineTicks).toBe(planOffline(s, cap, 0.5).offlineTicks);
  });

  it('returns 0 ticks for negative elapsed time (clock skew protection)', () => {
    const result = planOffline(s, -5000, 0.5);
    expect(result.offlineTicks).toBe(0);
    expect(result.effectiveMs).toBe(0);
  });

  it('handles efficiency > 1.0 (100%+) gracefully for future-proofing', () => {
    expect(planOffline(s, 60_000, 1.5).offlineTicks).toBe(Math.floor(ticksFor(60_000) * 1.5));
  });
});
