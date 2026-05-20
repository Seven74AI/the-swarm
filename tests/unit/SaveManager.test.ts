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
      state.workersAssigned = { gather: 3, tend: 1, dig: 0, guard: 0 };
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
      expect(parsed.version).toBe(8);
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
});
