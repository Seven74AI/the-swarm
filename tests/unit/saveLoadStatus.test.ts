// @vitest-environment node
/**
 * Story 2.2 (AR6, UX-DR33, NFR8): a save that can't be read is never
 * silently reset. SaveManager reads through the SaveStore and reports a load
 * status; while the save is unreadable nothing is written until the player
 * chooses LOAD BACKUP or START OVER.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveManager } from '../../src/persistence/SaveManager';
import { SAVE_KEYS, createLocalSaveStore, type RemovableStore } from '../../src/platform/storage/SaveStore';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { log } from '../../src/utils/log';

function memory(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const refused = new Set<string>();
  const kv: RemovableStore & { refuse(key: string): void; allow(): void } = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (refused.has(k)) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
    refuse: (k) => refused.add(k),
    allow: () => refused.clear(),
  };
  return kv;
}

function stateWith(eggs: number): GameState {
  const s = createInitialState();
  return { ...s, resources: { ...s.resources, eggs } };
}

/** A well-formed save text at the current version. */
function goodSave(eggs: number): string {
  const kv = memory();
  new SaveManager(createLocalSaveStore(kv)).save(stateWith(eggs), 0, true);
  return kv.getItem(SAVE_KEYS.primary)!;
}

const CORRUPT_JSON = '{"version": 19, "gameState": {';
const FUTURE_VERSION = JSON.stringify({
  version: SaveManager.SAVE_VERSION + 1,
  timestamp: Date.now(),
  playTimeMs: 0,
  gameState: createInitialState(),
});
/** A v1 save whose state lacks what the v1 → v2 step reads: that migration throws. */
const FAILING_MIGRATION = JSON.stringify({ version: 1, timestamp: Date.now(), playTimeMs: 0, gameState: {} });

const CASES: [string, string][] = [
  ['corrupt JSON', CORRUPT_JSON],
  ['an unknown future version', FUTURE_VERSION],
  ['a migration that throws', FAILING_MIGRATION],
];

describe('SaveManager load status (Story 2.2)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is empty with no save, and ok with a good one', () => {
    expect(new SaveManager(createLocalSaveStore(memory())).open().status).toBe('empty');
    const opened = new SaveManager(createLocalSaveStore(memory({ [SAVE_KEYS.primary]: goodSave(7) }))).open();
    expect(opened.status).toBe('ok');
    expect(opened.state?.gameState.resources.eggs).toBe(7);
  });

  it('the migration step really throws on the failing-migration save', async () => {
    const { migrateSave } = await import('../../src/persistence/migrations');
    expect(() => migrateSave(JSON.parse(FAILING_MIGRATION), 1, SaveManager.SAVE_VERSION)).toThrow();
  });

  describe.each(CASES)('a primary save with %s', (_name, text) => {
    it('is unreadable, offers the readable backup, and keeps the text aside', () => {
      const backup = goodSave(5);
      const kv = memory({ [SAVE_KEYS.primary]: text, [SAVE_KEYS.backup1]: backup });
      const mgr = new SaveManager(createLocalSaveStore(kv));
      const opened = mgr.open();
      expect(opened.status).toBe('unreadable');
      expect(opened.state).toBeUndefined();
      expect(opened.backup?.slot).toBe('backup1');
      expect(opened.backup?.state.gameState.resources.eggs).toBe(5);
      expect(mgr.unreadableText()).toBe(text);
      expect(kv.getItem(SAVE_KEYS.unreadable)).toBe(text);
    });

    it('is never overwritten by a save, the autosave or a forced (beforeunload) save until the player chooses', () => {
      const backup = goodSave(5);
      const kv = memory({ [SAVE_KEYS.primary]: text, [SAVE_KEYS.backup1]: backup });
      const mgr = new SaveManager(createLocalSaveStore(kv));
      expect(mgr.open().status).toBe('unreadable');
      expect(mgr.isHeld()).toBe(true);

      expect(mgr.save(stateWith(1), 0)).toBe(false);
      expect(mgr.save(stateWith(2), 0, true)).toBe(false);
      mgr.startAutosave(() => ({ state: stateWith(3), playTimeMs: 0 }));
      vi.advanceTimersByTime(10 * 60_000);
      mgr.stopAutosave();

      expect(kv.getItem(SAVE_KEYS.primary)).toBe(text);
      expect(kv.getItem(SAVE_KEYS.backup1)).toBe(backup);
      expect(kv.getItem(SAVE_KEYS.backup2)).toBeNull();
    });

    it('LOAD BACKUP makes the backup the save, and it then loads as ok', () => {
      const kv = memory({ [SAVE_KEYS.primary]: text, [SAVE_KEYS.backup2]: goodSave(5) });
      const mgr = new SaveManager(createLocalSaveStore(kv));
      const opened = mgr.open();
      expect(mgr.loadBackup(opened.backup!.slot)).toBe(true);
      const again = new SaveManager(createLocalSaveStore(kv)).open();
      expect(again.status).toBe('ok');
      expect(again.state?.gameState.resources.eggs).toBe(5);
      expect(kv.getItem(SAVE_KEYS.unreadable)).toBe(text);
    });

    it('START OVER writes the fresh run and saving works again', () => {
      const kv = memory({ [SAVE_KEYS.primary]: text });
      const mgr = new SaveManager(createLocalSaveStore(kv));
      expect(mgr.open().backup).toBeUndefined();
      expect(mgr.startOver(stateWith(0), 0)).toBe(true);
      expect(mgr.isHeld()).toBe(false);
      const again = new SaveManager(createLocalSaveStore(kv)).open();
      expect(again.status).toBe('ok');
      // The damaged save stays aside, and never lands in a backup slot.
      expect(kv.getItem(SAVE_KEYS.unreadable)).toBe(text);
      expect(kv.getItem(SAVE_KEYS.backup1)).not.toBe(text);
      vi.advanceTimersByTime(6000);
      expect(mgr.save(stateWith(9), 0)).toBe(true);
      expect(new SaveManager(createLocalSaveStore(kv)).open().state?.gameState.resources.eggs).toBe(9);
    });

    it('load() (the plain loader) still gives no state for it', () => {
      const mgr = new SaveManager(createLocalSaveStore(memory({ [SAVE_KEYS.primary]: text })));
      expect(mgr.load()).toBeNull();
    });
  });

  it('a missing primary is recovered from the backup with a warning', () => {
    const warn = vi.spyOn(log, 'warn');
    const mgr = new SaveManager(createLocalSaveStore(memory({ [SAVE_KEYS.backup1]: goodSave(4) })));
    const opened = mgr.open();
    expect(opened.status).toBe('recoveredFromBackup');
    expect(opened.state?.gameState.resources.eggs).toBe(4);
    expect(mgr.isHeld()).toBe(false);
    expect(warn).toHaveBeenCalledWith('save', expect.any(String), expect.anything());
  });

  describe('a save write that fails', () => {
    it('reports failing once, keeps the last good save, and reports recovery after the next good write', () => {
      const kv = memory();
      const mgr = new SaveManager(createLocalSaveStore(kv));
      const statuses: boolean[] = [];
      mgr.onSaveStatus((failing) => statuses.push(failing));
      expect(mgr.save(stateWith(1), 0, true)).toBe(true);
      const good = kv.getItem(SAVE_KEYS.primary);

      kv.refuse(SAVE_KEYS.primary);
      expect(mgr.save(stateWith(2), 0, true)).toBe(false);
      expect(mgr.save(stateWith(3), 0, true)).toBe(false);
      expect(mgr.isFailing()).toBe(true);
      expect(kv.getItem(SAVE_KEYS.primary)).toBe(good);

      kv.allow();
      expect(mgr.save(stateWith(4), 0, true)).toBe(true);
      expect(mgr.isFailing()).toBe(false);
      expect(statuses).toEqual([true, false]);
    });
  });
});
