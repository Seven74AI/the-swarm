import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../src/platform/storage/SaveStore';
import { createInitialState } from '../../src/state/GameState';
import type { GameState } from '../../src/state/GameState';
import { Phase } from '../../src/phases/phases';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../src/phases/transitions';

describe('SaveManager', () => {
  let saveManager: SaveManager;

  beforeEach(() => {
    localStorage.clear();
    saveManager = new SaveManager(createLocalSaveStore(localStorage));
  });

  describe('no pause in the save (Story 2.10, FR25)', () => {
    it('the game state has no paused field', () => {
      expect('paused' in createInitialState()).toBe(false);
    });

    it('an old save that was paused loads without it, and its next save has none', () => {
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: 22, timestamp: Date.now(), playTimeMs: 0, gameState: { ...createInitialState(), paused: true } }),
      );
      const loaded = saveManager.load()!;
      expect('paused' in loaded.gameState).toBe(false);
      const text = saveManager.serialize(loaded.gameState, 0);
      expect('paused' in JSON.parse(text).gameState).toBe(false);
    });
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
      expect(parsed.version).toBe(SaveManager.SAVE_VERSION);
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

  describe('the chronicle (Story 1.26)', () => {
    it('writes the chronicle source into the save and reads it back', () => {
      const chronicle = { entries: [{ message: 'a line', timestamp: 3, target: 'building_panel' as const }], milestones: ['first_egg'] };
      saveManager.setChronicleSource(() => chronicle);
      saveManager.save(createInitialState(), 0, true);
      expect(JSON.parse(saveManager.serialize(createInitialState(), 0)).chronicle).toEqual(chronicle);
      expect(new SaveManager(createLocalSaveStore(localStorage)).load()!.chronicle).toEqual(chronicle);
    });

    it('loads an older save with an empty chronicle', () => {
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: 16, timestamp: Date.now(), playTimeMs: 0, gameState: createInitialState() }),
      );
      expect(saveManager.load()!.chronicle.entries).toEqual([]);
    });

    it('keeps an open decision event with its time left (Story 1.28)', () => {
      const open = { id: 'overcrowding' as const, remainingMs: 12_345, openedAtSessionMs: 99_000, roll: 0.25 };
      const state = { ...createInitialState(), decision: { open, nextSpawnSessionMs: 150_000 } };
      saveManager.save(state, 0, true);
      expect(new SaveManager(createLocalSaveStore(localStorage)).load()!.gameState.decision.open).toEqual(open);
    });

    it('drops a malformed chronicle instead of failing the load', () => {
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: 17, timestamp: Date.now(), playTimeMs: 0, gameState: createInitialState(), chronicle: 'junk' }),
      );
      const loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.chronicle.entries).toEqual([]);
    });
  });

  describe('saves that took the old COLONY → EXPANSION shortcut', () => {
    it('still load in EXPANSION, and the phase machine keeps them there', () => {
      // An older save that reached EXPANSION without fighting a battle.
      const old = createInitialState();
      old.phase = 'expansion';
      old.battlesWon = 0;
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: 11, timestamp: Date.now(), playTimeMs: 0, gameState: old }),
      );

      const loaded = saveManager.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.gameState.phase).toBe(Phase.EXPANSION);

      // No goal can latch out of EXPANSION back into another phase: only EXPANSION's own exit.
      const sm = new PhaseStateMachine(TRANSITIONS);
      expect(sm.evaluate(loaded!.gameState)?.from ?? Phase.EXPANSION).toBe(Phase.EXPANSION);
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

  // Story 2.3 (D1): the save says when the game was last seen running; the gap is
  // worked out by the one resume path (engine/resume.ts), not by the loader.
  describe('lastSeenAt (Story 2.3)', () => {
    it('writes lastSeenAt from its source and reads it back', () => {
      saveManager.setSeenAtSource(() => 123_456);
      saveManager.save(createInitialState(), 0, true);
      expect(JSON.parse(localStorage.getItem('the_swarm_save')!).lastSeenAt).toBe(123_456);
      expect(new SaveManager(createLocalSaveStore(localStorage)).load()!.lastSeenAt).toBe(123_456);
    });

    it('a save written while hidden keeps the hidden moment, not the write time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));
      const hiddenAt = Date.now();
      saveManager.setSeenAtSource(() => hiddenAt);
      vi.setSystemTime(new Date('2026-05-20T13:00:00Z')); // an autosave an hour later
      saveManager.save(createInitialState(), 0, true);
      expect(saveManager.load()!.lastSeenAt).toBe(hiddenAt);
      vi.useRealTimers();
    });

    it('without a source, lastSeenAt is the time of writing', () => {
      const before = Date.now();
      saveManager.save(createInitialState(), 0, true);
      const seen = saveManager.load()!.lastSeenAt!;
      expect(seen).toBeGreaterThanOrEqual(before);
      expect(seen).toBeLessThanOrEqual(Date.now());
    });

    it('a current save with a malformed lastSeenAt falls back to its timestamp', () => {
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({ version: SaveManager.SAVE_VERSION, timestamp: 5_000, playTimeMs: 0, gameState: createInitialState(), lastSeenAt: 'x' }),
      );
      expect(saveManager.load()!.lastSeenAt).toBe(5_000);
    });

    it('no save means no lastSeenAt (fresh game)', () => {
      expect(saveManager.load()).toBeNull();
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

  describe('save failure (Story 1.32)', () => {
    it('tells its failure listener once when saving starts failing, and again only after a save succeeds', () => {
      const failed = vi.fn();
      saveManager.onSaveFailed(failed);
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(saveManager.save(createInitialState(), 0, true)).toBe(false);
      expect(saveManager.save(createInitialState(), 0, true)).toBe(false);
      expect(failed).toHaveBeenCalledTimes(1);
      spy.mockRestore();
      expect(saveManager.save(createInitialState(), 0, true)).toBe(true);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      saveManager.save(createInitialState(), 0, true);
      expect(failed).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    });
  });
});
