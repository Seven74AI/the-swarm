import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../../src/persistence/SaveManager';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';

describe('SaveManager', () => {
  let saveManager: SaveManager;

  beforeEach(() => {
    localStorage.clear();
    saveManager = new SaveManager();
  });

  describe('save + load round-trip', () => {
    it('loads the same state that was saved', () => {
      const state = createInitialState();
      state.resources.eggs = 42;
      state.resources.workers = 7;
      state.stats.totalClicks = 10;
      state.phase = 'egg_laying';
      const playTimeMs = 5000;

      saveManager.save(state, playTimeMs);
      const loaded = saveManager.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.gameState.resources.eggs).toBe(42);
      expect(loaded!.gameState.resources.workers).toBe(7);
      expect(loaded!.gameState.stats.totalClicks).toBe(10);
      expect(loaded!.gameState.phase).toBe('egg_laying');
      expect(loaded!.playTimeMs).toBe(5000);
    });

    it('preserves complex nested state', () => {
      const state = createInitialState();
      state.resources.eggs = 5;
      state.eggPipeline = { count: 6, progress: 0.5 };
      state.larvaPipeline = { count: 10, progress: 3.2 };
      state.workersAssigned = { gather: 3, tend: 1, dig: 0, guard: 0, researchers: 0 };
      state.upgrades = { click_power: 2 };
      state.unlockedPanels = ['resource_panel'];

      saveManager.save(state, 10000);
      const loaded = saveManager.load();

      expect(loaded).not.toBeNull();
      expect(loaded!.gameState.eggPipeline).toEqual({ count: 6, progress: 0.5 });
      expect(loaded!.gameState.larvaPipeline).toEqual({ count: 10, progress: 3.2 });
      expect(loaded!.gameState.workersAssigned).toEqual({
        gather: 3,
        tend: 1,
        dig: 0,
        guard: 0,
        researchers: 0,
      });
      expect(loaded!.gameState.upgrades).toEqual({ click_power: 2 });
      expect(loaded!.gameState.unlockedPanels).toEqual(['resource_panel']);
    });

    it('includes version and timestamp in save data', () => {
      const state = createInitialState();
      const before = Date.now();
      saveManager.save(state, 0);
      const raw = localStorage.getItem('the_swarm_save');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.version).toBe(13);
      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('load', () => {
    it('returns null when no save exists', () => {
      const result = saveManager.load();
      expect(result).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem('the_swarm_save', 'not valid json{{{');
      const result = saveManager.load();
      // tryLoadKey catches JSON parse errors silently and falls through to backups
      // After #5 (migration wiring) and #21 (backup rotation), load uses tryLoadKey
      // which returns null on parse failure without console.warn
      expect(result).toBeNull();
    });

    it('returns null for partial/invalid save data', () => {
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: 1 }),
      );
      const result = saveManager.load();
      // Missing gameState — structural validation fails, returns null
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('save does not throw on serialization errors', () => {
      const state = createInitialState();
      (state as unknown as Record<string, unknown>).circular = state;
      expect(() => saveManager.save(state, 0)).not.toThrow();
    });
  });

  describe('deleteSave', () => {
    it('removes save from localStorage', () => {
      const state = createInitialState();
      saveManager.save(state, 0);
      expect(localStorage.getItem('the_swarm_save')).not.toBeNull();
      saveManager.deleteSave();
      expect(localStorage.getItem('the_swarm_save')).toBeNull();
    });
  });

  describe('autosave', () => {
    it('starts and stops autosave', () => {
      vi.useFakeTimers();

      const state = createInitialState();
      state.resources.eggs = 5;
      const getState = () => ({ state, playTimeMs: 0 });

      saveManager.startAutosave(getState);
      vi.advanceTimersByTime(29000);
      let loaded = saveManager.load();
      expect(loaded).toBeNull();

      vi.advanceTimersByTime(2000);
      loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.gameState.resources.eggs).toBe(5);

      saveManager.stopAutosave();

      const state2 = createInitialState();
      state2.resources.eggs = 99;
      const getState2 = () => ({ state: state2, playTimeMs: 10000 });
      saveManager.startAutosave(getState2);
      vi.advanceTimersByTime(31000);
      loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.gameState.resources.eggs).toBe(99);

      saveManager.stopAutosave();
      vi.useRealTimers();
    });
  });

  describe('offline progression', () => {
    it('load returns offline data when save has a past timestamp', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.offlineEfficiency = 0.5;
      saveManager.save(state, 0);

      // Simulate player being away for 1 hour
      vi.setSystemTime(new Date('2026-05-20T13:00:00Z'));

      const loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.offline).toBeDefined();
      expect(loaded!.offline!.elapsedMs).toBe(3_600_000); // 1h
      expect(loaded!.offline!.effectiveMs).toBe(3_600_000); // under cap
      expect(loaded!.offline!.offlineTicks).toBe(36000); // 72000 * 0.5

      vi.useRealTimers();
    });

    it('offline data is null when save is recent (< 1s)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      saveManager.save(state, 0);

      // Only 500ms later — not enough for offline catch-up
      vi.setSystemTime(new Date('2026-05-20T12:00:00.500Z'));

      const loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.offline).toBeNull();

      vi.useRealTimers();
    });

    it('offline data caps at 4 hours with 50% efficiency', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.offlineEfficiency = 0.5;
      saveManager.save(state, 0);

      // Simulate 24 hours away
      vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));

      const loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.offline!.elapsedMs).toBe(24 * 3_600_000);
      expect(loaded!.offline!.effectiveMs).toBe(4 * 3_600_000);
      expect(loaded!.offline!.offlineTicks).toBe(144000);

      vi.useRealTimers();
    });

    it('offline data respects efficiency from game state', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.offlineEfficiency = 0.75;
      saveManager.save(state, 0);

      vi.setSystemTime(new Date('2026-05-20T13:00:00Z')); // 1h later

      const loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      // 3600000ms / 50ms = 72000 ticks * 0.75 = 54000
      expect(loaded!.offline!.offlineTicks).toBe(54000);

      vi.useRealTimers();
    });

    it('offline data has efficiency from loaded state', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.offlineEfficiency = 1.0;
      saveManager.save(state, 0);

      vi.setSystemTime(new Date('2026-05-20T13:00:00Z'));

      const loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      // Full efficiency — all 72000 ticks
      expect(loaded!.offline!.offlineTicks).toBe(72000);

      vi.useRealTimers();
    });

    it('offline data is null when no save exists (fresh game)', () => {
      // No save at all
      const loaded = saveManager.load();
      expect(loaded).toBeNull();
    });
  });

  describe('action save rate limiting', () => {
    it('save() returns true on first call and persists', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.resources.eggs = 10;
      const result = saveManager.save(state, 0);
      expect(result).toBe(true);

      const loaded = saveManager.load();
      expect(loaded!.gameState.resources.eggs).toBe(10);

      vi.useRealTimers();
    });

    it('save() returns false when called within 5s of a previous action save', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.resources.eggs = 1;
      expect(saveManager.save(state, 0)).toBe(true);

      // 3 seconds later — should be rate-limited
      vi.setSystemTime(new Date('2026-05-20T12:00:03Z'));
      const state2 = createInitialState();
      state2.resources.eggs = 99;
      const result = saveManager.save(state2, 0);
      expect(result).toBe(false);

      // The loaded state should still have eggs=1 (first save)
      const loaded = saveManager.load();
      expect(loaded!.gameState.resources.eggs).toBe(1);

      vi.useRealTimers();
    });

    it('save() succeeds again after 5s cooldown expires', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.resources.eggs = 1;
      expect(saveManager.save(state, 0)).toBe(true);

      // 6 seconds later — cooldown expired
      vi.setSystemTime(new Date('2026-05-20T12:00:06Z'));
      const state2 = createInitialState();
      state2.resources.eggs = 42;
      const result = saveManager.save(state2, 0);
      expect(result).toBe(true);

      const loaded = saveManager.load();
      expect(loaded!.gameState.resources.eggs).toBe(42);

      vi.useRealTimers();
    });

    it('save() with force=true always saves, ignoring rate limit', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.resources.eggs = 1;
      expect(saveManager.save(state, 0, true)).toBe(true);

      // 1 second later — normally rate-limited, but force=true bypasses
      vi.setSystemTime(new Date('2026-05-20T12:00:01Z'));
      const state2 = createInitialState();
      state2.resources.eggs = 99;
      const result = saveManager.save(state2, 0, true);
      expect(result).toBe(true);

      const loaded = saveManager.load();
      expect(loaded!.gameState.resources.eggs).toBe(99);

      vi.useRealTimers();
    });

    it('autosave uses force=true and always persists', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      const state = createInitialState();
      state.resources.eggs = 5;
      saveManager.startAutosave(() => ({ state, playTimeMs: 0 }));

      // Autosave fires at 30s
      vi.advanceTimersByTime(30_000);
      let loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.gameState.resources.eggs).toBe(5);

      // Change state but advance only 10s — autosave hasn't fired again
      state.resources.eggs = 10;
      vi.advanceTimersByTime(10_000);
      loaded = saveManager.load();
      // Autosave hasn't fired at 40s total (only at 30s and 60s), so still eggs=5
      expect(loaded!.gameState.resources.eggs).toBe(5);

      // Advance to 60s — autosave fires again
      vi.advanceTimersByTime(20_000);
      loaded = saveManager.load();
      expect(loaded!.gameState.resources.eggs).toBe(10);

      saveManager.stopAutosave();
      vi.useRealTimers();
    });

    it('multiple rapid action saves only persist the first one per window', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

      // First save at t=0 — succeeds
      const s1 = createInitialState();
      s1.resources.eggs = 1;
      expect(saveManager.save(s1, 0)).toBe(true);

      // Rapid saves at t=1s, 2s, 3s, 4s — all skipped
      for (let i = 1; i <= 4; i++) {
        vi.setSystemTime(new Date(`2026-05-20T12:00:0${i}Z`));
        const s = createInitialState();
        s.resources.eggs = i * 100;
        expect(saveManager.save(s, 0)).toBe(false);
      }

      // t=6s — succeeds again
      vi.setSystemTime(new Date('2026-05-20T12:00:06Z'));
      const sFinal = createInitialState();
      sFinal.resources.eggs = 999;
      expect(saveManager.save(sFinal, 0)).toBe(true);

      const loaded = saveManager.load();
      expect(loaded!.gameState.resources.eggs).toBe(999);

      vi.useRealTimers();
    });
  });
});
