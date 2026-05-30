import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';
import { calculateOfflineTicks } from '../../src/systems/OfflineProgression';

describe('GameState offlineEfficiency', () => {
  it('offlineEfficiency defaults to 0.5 (50%) in createInitialState', () => {
    const state = createInitialState();
    expect(state.offlineEfficiency).toBe(0.5);
  });

  it('offlineEfficiency is a number on the GameState interface', () => {
    const state = createInitialState();
    expect(typeof state.offlineEfficiency).toBe('number');
  });

  it('offlineEfficiency is preserved across save/load round-trip', () => {
    const state = createInitialState();
    // Modify efficiency to ensure it survives serialization
    (state as GameState).offlineEfficiency = 0.75;

    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as GameState;
    expect(restored.offlineEfficiency).toBe(0.75);
  });
});

describe('calculateOfflineTicks', () => {
  const TICK_MS = 50; // 50ms per tick (standard game tick)

  it('returns 0 ticks when no time has elapsed', () => {
    const result = calculateOfflineTicks(0, 0.5, TICK_MS);
    expect(result.offlineTicks).toBe(0);
    expect(result.effectiveMs).toBe(0);
  });

  it('computes correct ticks for 30s absence at 50% efficiency', () => {
    const elapsedMs = 30_000;
    const result = calculateOfflineTicks(elapsedMs, 0.5, TICK_MS);
    // 30000ms / 50ms = 600 ticks * 0.5 = 300
    expect(result.offlineTicks).toBe(300);
    expect(result.effectiveMs).toBe(elapsedMs); // under cap
  });

  it('computes correct ticks for 1h absence at 50% efficiency', () => {
    const elapsedMs = 3_600_000;
    const result = calculateOfflineTicks(elapsedMs, 0.5, TICK_MS);
    // 3600000 / 50 = 72000 * 0.5 = 36000
    expect(result.offlineTicks).toBe(36000);
  });

  it('caps at 4 hours max', () => {
    const elapsedMs = 8 * 60 * 60 * 1000; // 8h (exceeds 4h cap)
    const result = calculateOfflineTicks(elapsedMs, 0.5, TICK_MS);
    // 14400000 / 50 = 288000 * 0.5 = 144000
    expect(result.effectiveMs).toBe(4 * 60 * 60 * 1000);
    expect(result.offlineTicks).toBe(144000);
  });

  it('caps 24h absence at 4h (same as 4h result)', () => {
    const elapsed24h = 24 * 60 * 60 * 1000;
    const result = calculateOfflineTicks(elapsed24h, 0.5, TICK_MS);
    expect(result.effectiveMs).toBe(4 * 60 * 60 * 1000); // capped
    expect(result.offlineTicks).toBe(144000); // same as 4h at 50%
  });

  it('applies 75% efficiency correctly for 1h absence', () => {
    const elapsedMs = 3_600_000;
    const result = calculateOfflineTicks(elapsedMs, 0.75, TICK_MS);
    // 3600000 / 50 = 72000 * 0.75 = 54000
    expect(result.offlineTicks).toBe(54000);
  });

  it('applies 100% efficiency correctly for 4h absence', () => {
    const elapsedMs = 4 * 60 * 60 * 1000; // 4h (at new cap)
    const result = calculateOfflineTicks(elapsedMs, 1.0, TICK_MS);
    // 14400000 / 50 = 288000 * 1.0 = 288000
    expect(result.offlineTicks).toBe(288000);
  });

  it('returns 0 ticks for negative elapsed time (clock skew protection)', () => {
    const result = calculateOfflineTicks(-5000, 0.5, TICK_MS);
    expect(result.offlineTicks).toBe(0);
    expect(result.effectiveMs).toBe(0);
  });

  it('handles efficiency > 1.0 (100%+) gracefully for future-proofing', () => {
    const elapsedMs = 60_000;
    const result = calculateOfflineTicks(elapsedMs, 1.5, TICK_MS);
    // 60000 / 50 = 1200 * 1.5 = 1800
    expect(result.offlineTicks).toBe(1800);
  });
});
