import { describe, expect, it, vi } from 'vitest';
import { createWebPlatform } from '../../../src/platform';
import { SETTINGS_KEY } from '../../../src/platform/settings';
import { SAVE_KEYS } from '../../../src/platform/storage/SaveStore';

describe('createWebPlatform (Story 1.10)', () => {
  it('builds capabilities, settings and haptics from one environment', () => {
    const vibrate = vi.fn(() => true);
    const data: Record<string, string> = {};
    const p = createWebPlatform({
      navigator: { vibrate },
      matchMedia: () => ({ matches: false }),
      localStorage: {
        getItem: (k) => data[k] ?? null,
        setItem: (k, v) => void (data[k] = v),
        removeItem: (k) => void delete data[k],
      },
    });
    expect(p.capabilities.vibrate).toBe(true);
    expect(p.settings.settings.value.haptics).toBe(true);
    p.haptics.play('heavy');
    expect(vibrate).toHaveBeenCalledTimes(1);
    p.settings.update({ haptics: false });
    p.haptics.play('heavy');
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(data[SETTINGS_KEY]).toBeDefined();
  });

  it('keeps the save and the intro flag in the same storage (Story 2.2)', () => {
    const data: Record<string, string> = {};
    const p = createWebPlatform({
      localStorage: { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] },
    });
    p.saves.write('text');
    expect(data[SAVE_KEYS.primary]).toBe('text');
    p.introFlag.markDone();
    expect(p.introFlag.done()).toBe(true);
  });

  it('asks navigator.storage for persistence through platform.durability (Story 2.12)', async () => {
    const persist = vi.fn(async () => true);
    const p = createWebPlatform({ navigator: { storage: { persist } }, matchMedia: () => ({ matches: false }) });
    expect(await p.durability.requestPersist()).toBe('granted');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('builds an Audio service that follows the sound setting, off by default (Story 8.8)', () => {
    const p = createWebPlatform({ AudioContext: class {}, addEventListener: () => {} });
    expect(p.audio.available).toBe(true);
    expect(p.audio.muted).toBe(true);
    p.settings.update({ sound: true });
    expect(p.audio.muted).toBe(false);
    p.settings.update({ sound: false });
    expect(p.audio.muted).toBe(true);
  });

  it('boots on an environment with no browser APIs at all', () => {
    const p = createWebPlatform({});
    expect(p.audio.available).toBe(false);
    expect(() => p.audio.play('key')).not.toThrow();
    expect(p.capabilities.vibrate).toBe(false);
    expect(p.settings.settings.value.haptics).toBe(false);
    expect(() => p.haptics.play('double')).not.toThrow();
    expect(p.viewport.wide.value).toBe(false);
    expect(p.durability.wantsHomeScreenHint()).toBe(false);
  });

  it('has a service worker service that registers nothing where service workers are missing (Story 2.13)', async () => {
    const p = createWebPlatform({});
    const status = await p.serviceWorker.register({ enabled: true, url: '/the-swarm/sw.js', scope: '/the-swarm/', onUpdateReady: vi.fn() });
    expect(status).toBe('unsupported');
  });

  it('survives storage that throws on access', () => {
    const env = {
      get localStorage(): never {
        throw new Error('SecurityError');
      },
    };
    expect(() => createWebPlatform(env)).not.toThrow();
    const p = createWebPlatform(env);
    expect(p.saves.load(() => 1).status).toBe('empty');
    expect(() => p.saves.write('x')).toThrow();
  });
});
