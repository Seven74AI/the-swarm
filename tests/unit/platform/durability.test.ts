import { describe, expect, it, vi } from 'vitest';
import {
  createDurability,
  HOME_HINT_KEY,
  PERSIST_KEY,
  type StorageManagerLike,
} from '../../../src/platform/storage/durability';
import type { Capabilities } from '../../../src/platform/capabilities';
import type { RemovableStore } from '../../../src/platform/storage/SaveStore';

function memory(): RemovableStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

const PHONE: Capabilities = { vibrate: true, standalone: false, reducedMotion: false, moreContrast: false, mobile: true, audio: false };

function manager(grant: boolean, persisted = false): StorageManagerLike & { persist: ReturnType<typeof vi.fn> } {
  return { persist: vi.fn(async () => grant), persisted: vi.fn(async () => persisted) };
}

describe('createDurability: navigator.storage.persist() (Story 2.12)', () => {
  it('asks the browser once and reports what it answered', async () => {
    const storageManager = manager(true);
    const d = createDurability({ storageManager, storage: memory(), capabilities: PHONE });
    expect(await d.requestPersist()).toBe('granted');
    expect(storageManager.persist).toHaveBeenCalledTimes(1);
    expect(d.status()).toBe('granted');
  });

  it('a second request in the same session never asks again', async () => {
    const storageManager = manager(false);
    const d = createDurability({ storageManager, storage: memory(), capabilities: PHONE });
    const first = await d.requestPersist();
    const second = await d.requestPersist();
    expect(first).toBe('denied');
    expect(second).toBe(first);
    expect(storageManager.persist).toHaveBeenCalledTimes(1);
  });

  it('remembers the ask outside the save, so a later load does not ask again', async () => {
    const storage = memory();
    const first = manager(false);
    await createDurability({ storageManager: first, storage, capabilities: PHONE }).requestPersist();
    expect(storage.data[PERSIST_KEY]).toBeDefined();
    const later = manager(true);
    const outcome = await createDurability({ storageManager: later, storage, capabilities: PHONE }).requestPersist();
    expect(later.persist).not.toHaveBeenCalled();
    expect(outcome).toBe('asked');
  });

  it('does not ask when the storage is already persistent', async () => {
    const storageManager = manager(true, true);
    const d = createDurability({ storageManager, storage: memory(), capabilities: PHONE });
    expect(await d.requestPersist()).toBe('already');
    expect(storageManager.persist).not.toHaveBeenCalled();
  });

  it('reports unsupported where the browser has no persist()', async () => {
    expect(await createDurability({ storageManager: undefined, storage: memory(), capabilities: PHONE }).requestPersist()).toBe(
      'unsupported',
    );
    expect(await createDurability({ storageManager: {}, storage: memory(), capabilities: PHONE }).requestPersist()).toBe('unsupported');
  });

  it('never rejects: a throwing or rejecting persist() is reported as failed', async () => {
    const throwing: StorageManagerLike = {
      persist: () => {
        throw new Error('blocked');
      },
    };
    const rejecting: StorageManagerLike = { persist: () => Promise.reject(new Error('nope')) };
    expect(await createDurability({ storageManager: throwing, storage: memory(), capabilities: PHONE }).requestPersist()).toBe('failed');
    expect(await createDurability({ storageManager: rejecting, storage: memory(), capabilities: PHONE }).requestPersist()).toBe('failed');
  });

  it('works with blocked localStorage (the ask then lasts the session)', async () => {
    const blocked: RemovableStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const storageManager = manager(true);
    const d = createDurability({ storageManager, storage: blocked, capabilities: PHONE });
    expect(await d.requestPersist()).toBe('granted');
    await d.requestPersist();
    expect(storageManager.persist).toHaveBeenCalledTimes(1);
  });

  it('has no status before anything was asked', () => {
    expect(createDurability({ storageManager: manager(true), storage: memory(), capabilities: PHONE }).status()).toBeNull();
  });
});

describe('createDurability: the add-to-home-screen hint (Story 2.12)', () => {
  it('is wanted on a mobile browser that is not the installed app', () => {
    expect(createDurability({ storageManager: undefined, storage: memory(), capabilities: PHONE }).wantsHomeScreenHint()).toBe(true);
  });

  it('is not wanted in the installed app or on a desktop browser', () => {
    const installed = { ...PHONE, standalone: true };
    const desktop = { ...PHONE, mobile: false, audio: false };
    expect(createDurability({ storageManager: undefined, storage: memory(), capabilities: installed }).wantsHomeScreenHint()).toBe(false);
    expect(createDurability({ storageManager: undefined, storage: memory(), capabilities: desktop }).wantsHomeScreenHint()).toBe(false);
  });

  it('shows once: marking it seen is remembered under its own key, outside the save', () => {
    const storage = memory();
    const d = createDurability({ storageManager: undefined, storage, capabilities: PHONE });
    d.markHomeScreenHintSeen();
    expect(d.wantsHomeScreenHint()).toBe(false);
    expect(storage.data[HOME_HINT_KEY]).toBeDefined();
    expect(Object.keys(storage.data).every((k) => !k.startsWith('the_swarm_save'))).toBe(true);
    expect(createDurability({ storageManager: undefined, storage, capabilities: PHONE }).wantsHomeScreenHint()).toBe(false);
  });

  it('with blocked storage, seen lasts the session', () => {
    const blocked: RemovableStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    const d = createDurability({ storageManager: undefined, storage: blocked, capabilities: PHONE });
    expect(d.wantsHomeScreenHint()).toBe(true);
    d.markHomeScreenHintSeen();
    expect(d.wantsHomeScreenHint()).toBe(false);
  });
});
