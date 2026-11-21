// @vitest-environment node
/**
 * The save store (Story 2.2, AR6/D4): one primary slot, a 2-slot rotating
 * backup, a key the unreadable save is kept under, and a load that says what
 * it found instead of resetting.
 */
import { describe, expect, it } from 'vitest';
import {
  SAVE_KEYS,
  createLocalSaveStore,
  type RemovableStore,
} from '../../../src/platform/storage/SaveStore';

/** An in-memory localStorage; `refuse(key)` makes writes to that key throw (quota). */
function memory(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const refused = new Set<string>();
  const store: RemovableStore & { refuse(key: string): void; allow(): void; dump(): Record<string, string> } = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (refused.has(k)) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
    refuse: (k) => refused.add(k),
    allow: () => refused.clear(),
    dump: () => Object.fromEntries(data),
  };
  return store;
}

/** A decoder that accepts `ok:<n>` and throws on anything else (a parse or migration failure). */
const decode = (text: string): number => {
  const m = /^ok:(\d+)$/.exec(text);
  if (!m) throw new Error(`can't read ${text}`);
  return Number(m[1]);
};

describe('SaveStore (localStorage)', () => {
  it('keeps the existing keys', () => {
    expect(SAVE_KEYS.primary).toBe('the_swarm_save');
    expect(SAVE_KEYS.backup1).toBe('the_swarm_save_bak1');
    expect(SAVE_KEYS.backup2).toBe('the_swarm_save_bak2');
    expect(new Set(Object.values(SAVE_KEYS)).size).toBe(Object.values(SAVE_KEYS).length);
  });

  it('is empty when nothing was ever saved', () => {
    expect(createLocalSaveStore(memory()).load(decode)).toEqual({ status: 'empty' });
  });

  it('rotates: each write pushes the previous primary into backup 1, and backup 1 into backup 2', () => {
    const kv = memory();
    const store = createLocalSaveStore(kv);
    store.write('ok:1');
    store.write('ok:2');
    store.write('ok:3');
    expect(kv.getItem(SAVE_KEYS.primary)).toBe('ok:3');
    expect(kv.getItem(SAVE_KEYS.backup1)).toBe('ok:2');
    expect(kv.getItem(SAVE_KEYS.backup2)).toBe('ok:1');
    expect(store.load(decode)).toEqual({ status: 'ok', state: 3 });
  });

  it('a readable primary loads as ok', () => {
    const store = createLocalSaveStore(memory({ [SAVE_KEYS.primary]: 'ok:5', [SAVE_KEYS.backup1]: 'ok:4' }));
    expect(store.load(decode)).toEqual({ status: 'ok', state: 5 });
  });

  it('a missing primary with a readable backup is recovered from that backup', () => {
    const store = createLocalSaveStore(memory({ [SAVE_KEYS.backup1]: 'junk', [SAVE_KEYS.backup2]: 'ok:2' }));
    const result = store.load(decode);
    expect(result.status).toBe('recoveredFromBackup');
    expect(result.state).toBe(2);
    expect(result.slot).toBe('backup2');
  });

  describe('a primary that cannot be read', () => {
    it('is unreadable, never silently replaced by a backup or a fresh start', () => {
      const store = createLocalSaveStore(memory({ [SAVE_KEYS.primary]: 'junk', [SAVE_KEYS.backup1]: 'ok:4' }));
      const result = store.load(decode);
      expect(result.status).toBe('unreadable');
      expect(result.state).toBeUndefined();
      expect(result.raw).toBe('junk');
      expect(result.error).toBeInstanceOf(Error);
    });

    it('offers the newest readable backup', () => {
      const store = createLocalSaveStore(
        memory({ [SAVE_KEYS.primary]: 'junk', [SAVE_KEYS.backup1]: 'also junk', [SAVE_KEYS.backup2]: 'ok:3' }),
      );
      expect(store.load(decode).backup).toEqual({ slot: 'backup2', state: 3 });
    });

    it('offers no backup when none can be read', () => {
      const store = createLocalSaveStore(memory({ [SAVE_KEYS.primary]: 'junk', [SAVE_KEYS.backup1]: 'junk' }));
      const result = store.load(decode);
      expect(result.status).toBe('unreadable');
      expect(result.backup).toBeUndefined();
    });

    it('is kept aside under its own key at load, and every slot is left as it was', () => {
      const seed = { [SAVE_KEYS.primary]: 'junk', [SAVE_KEYS.backup1]: 'ok:4', [SAVE_KEYS.backup2]: 'ok:3' };
      const kv = memory(seed);
      createLocalSaveStore(kv).load(decode);
      expect(kv.dump()).toEqual({ ...seed, [SAVE_KEYS.unreadable]: 'junk' });
      expect(createLocalSaveStore(kv).unreadable()).toBe('junk');
    });

    it('is unreadable when only backups exist and none can be read', () => {
      const store = createLocalSaveStore(memory({ [SAVE_KEYS.backup1]: 'junk' }));
      const result = store.load(decode);
      expect(result.status).toBe('unreadable');
      expect(result.raw).toBe('junk');
    });
  });

  it('restore makes a backup the primary, keeping the unreadable text aside', () => {
    const kv = memory({ [SAVE_KEYS.primary]: 'junk', [SAVE_KEYS.backup1]: 'ok:4' });
    const store = createLocalSaveStore(kv);
    store.load(decode);
    store.restore('backup1');
    expect(store.load(decode)).toEqual({ status: 'ok', state: 4 });
    expect(store.unreadable()).toBe('junk');
  });

  it('discardPrimary drops only the primary', () => {
    const kv = memory({ [SAVE_KEYS.primary]: 'junk', [SAVE_KEYS.backup1]: 'ok:4' });
    const store = createLocalSaveStore(kv);
    store.load(decode);
    store.discardPrimary();
    expect(kv.getItem(SAVE_KEYS.primary)).toBeNull();
    expect(kv.getItem(SAVE_KEYS.backup1)).toBe('ok:4');
    expect(store.unreadable()).toBe('junk');
  });

  it('a write that storage refuses throws and leaves the last good primary untouched', () => {
    const kv = memory();
    const store = createLocalSaveStore(kv);
    store.write('ok:1');
    kv.refuse(SAVE_KEYS.primary);
    expect(() => store.write('ok:2')).toThrow();
    expect(kv.getItem(SAVE_KEYS.primary)).toBe('ok:1');
    expect(store.load(decode)).toEqual({ status: 'ok', state: 1 });
    kv.allow();
    store.write('ok:3');
    expect(store.load(decode)).toEqual({ status: 'ok', state: 3 });
  });

  it('clear removes the save and its backups, but keeps the unreadable copy', () => {
    const kv = memory({ [SAVE_KEYS.primary]: 'junk', [SAVE_KEYS.backup1]: 'ok:4' });
    const store = createLocalSaveStore(kv);
    store.load(decode);
    store.clear();
    expect(store.load(decode)).toEqual({ status: 'empty' });
    expect(store.unreadable()).toBe('junk');
  });

  it('storage that cannot be reached at all reads as empty and refuses writes', () => {
    const store = createLocalSaveStore(null);
    expect(store.load(decode)).toEqual({ status: 'empty' });
    expect(() => store.write('ok:1')).toThrow();
  });
});
