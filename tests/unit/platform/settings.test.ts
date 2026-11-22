import { describe, expect, it } from 'vitest';
import type { Capabilities } from '../../../src/platform/capabilities';
import {
  DEFAULT_KEY_BINDINGS,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  createSettingsStore,
  defaultSettings,
  type KeyValueStore,
} from '../../../src/platform/settings';

const caps = (over: Partial<Capabilities> = {}): Capabilities => ({
  vibrate: true,
  standalone: false,
  reducedMotion: false,
  moreContrast: false,
  reducedTransparency: false,
  textScale: 1,
  mobile: false,
  ...over,
});

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('settings store (Story 1.10)', () => {
  it('uses its own key and version, apart from the save', () => {
    expect(SETTINGS_KEY).toBe('the_swarm_settings');
    expect(Number.isInteger(SETTINGS_VERSION)).toBe(true);
    expect(SETTINGS_VERSION).toBeGreaterThan(0);
  });

  it('applies the documented defaults when no settings key exists', () => {
    const store = createSettingsStore({ storage: memoryStore(), capabilities: caps() });
    expect(store.settings.value).toEqual({
      sound: false,
      haptics: true,
      reducedMotion: 'os',
      crt: 'scene',
      decisionTimers: 'normal',
      confirmStyle: 'hold',
      confirmHoldMs: 1000,
      layMode: 'hold',
      keyboardShortcuts: true,
      keyBindings: DEFAULT_KEY_BINDINGS,
      coachMarksSeen: [],
    });
  });

  it('turns haptics on only where the device can vibrate', () => {
    expect(defaultSettings(caps({ vibrate: true })).haptics).toBe(true);
    expect(defaultSettings(caps({ vibrate: false })).haptics).toBe(false);
  });

  it('follows the OS for reduced motion until the player overrides it', () => {
    const osOn = createSettingsStore({ storage: memoryStore(), capabilities: caps({ reducedMotion: true }) });
    const osOff = createSettingsStore({ storage: memoryStore(), capabilities: caps({ reducedMotion: false }) });
    expect(osOn.reducedMotion.value).toBe(true);
    expect(osOff.reducedMotion.value).toBe(false);
    osOn.update({ reducedMotion: 'off' });
    osOff.update({ reducedMotion: 'on' });
    expect(osOn.reducedMotion.value).toBe(false);
    expect(osOff.reducedMotion.value).toBe(true);
  });

  it('CRT effects are off in effect under reduced motion, whatever the CRT choice (Story 1.32)', () => {
    const store = createSettingsStore({ storage: memoryStore(), capabilities: caps({ reducedMotion: false }) });
    store.update({ crt: 'full' });
    expect(store.crt.value).toBe('full');
    store.update({ reducedMotion: 'on' });
    expect(store.crt.value).toBe('off');
    // The choice itself is kept for when motion comes back.
    expect(store.settings.value.crt).toBe('full');
  });

  describe('CRT effects at boot (Story 8.4, UX-DR36)', () => {
    const stored = (crt: string) =>
      memoryStore({ [SETTINGS_KEY]: JSON.stringify({ version: SETTINGS_VERSION, settings: { crt } }) });

    it.each([
      ['the OS asks for more contrast', { moreContrast: true }],
      ['the OS asks for reduced transparency', { reducedTransparency: true }],
      ['the text scale is above 130%', { textScale: 1.31 }],
    ])('are OFF at boot when %s, whatever the stored choice', (_why, over) => {
      for (const crt of ['scene', 'full']) {
        const store = createSettingsStore({ storage: stored(crt), capabilities: caps(over) });
        expect(store.crt.value).toBe('off');
        expect(store.crtOffBy.value).toBe('device');
        // The choice itself is not overwritten.
        expect(store.settings.value.crt).toBe(crt);
      }
    });

    it('keep the choice at a text scale of 130% or less and without those OS requests', () => {
      for (const textScale of [1, 1.25, 1.3]) {
        const store = createSettingsStore({ storage: stored('full'), capabilities: caps({ textScale }) });
        expect(store.crt.value).toBe('full');
        expect(store.crtOffBy.value).toBeNull();
      }
    });

    it('follow a CRT choice the player makes after boot, even the one already stored', () => {
      const store = createSettingsStore({ storage: stored('scene'), capabilities: caps({ moreContrast: true }) });
      expect(store.crt.value).toBe('off');
      store.update({ crt: 'scene' });
      expect(store.crt.value).toBe('scene');
      expect(store.crtOffBy.value).toBeNull();
      store.update({ crt: 'full' });
      expect(store.crt.value).toBe('full');
    });

    it('other settings changes do not turn them back on', () => {
      const store = createSettingsStore({ storage: stored('scene'), capabilities: caps({ reducedTransparency: true }) });
      store.update({ sound: true });
      expect(store.crt.value).toBe('off');
    });

    it('say reduced motion is why they are off, while it is on', () => {
      const store = createSettingsStore({ storage: stored('scene'), capabilities: caps({ reducedMotion: true }) });
      expect(store.crt.value).toBe('off');
      expect(store.crtOffBy.value).toBe('reducedMotion');
    });

    it('name no reason when the player chose OFF', () => {
      const store = createSettingsStore({ storage: stored('off'), capabilities: caps({ moreContrast: true }) });
      expect(store.crtOffBy.value).toBeNull();
    });
  });

  it('writes every change to its key at once, with its version', () => {
    const storage = memoryStore();
    const store = createSettingsStore({ storage, capabilities: caps() });
    store.update({ sound: true, crt: 'off' });
    const saved = JSON.parse(storage.data[SETTINGS_KEY]);
    expect(saved.version).toBe(SETTINGS_VERSION);
    expect(saved.settings).toMatchObject({ sound: true, crt: 'off' });
    expect(Object.keys(storage.data)).toEqual([SETTINGS_KEY]);
  });

  it('reads back what an earlier session wrote', () => {
    const storage = memoryStore();
    createSettingsStore({ storage, capabilities: caps() }).update({ layMode: 'toggle', keyboardShortcuts: false });
    const again = createSettingsStore({ storage, capabilities: caps() });
    expect(again.settings.value).toMatchObject({ layMode: 'toggle', keyboardShortcuts: false });
  });

  it('is one signal: an update replaces the value and leaves the old one untouched', () => {
    const store = createSettingsStore({ storage: memoryStore(), capabilities: caps() });
    const before = store.settings.value;
    store.update({ decisionTimers: 'double' });
    expect(store.settings.value).not.toBe(before);
    expect(before.decisionTimers).toBe('normal');
    expect(Object.isFrozen(store.settings.value)).toBe(true);
  });

  it('falls back to defaults for corrupt JSON, a wrong shape or a newer version', () => {
    const defaults = defaultSettings(caps());
    for (const raw of ['{not json', '"text"', 'null', JSON.stringify({ version: SETTINGS_VERSION + 1, settings: { sound: true } })]) {
      const store = createSettingsStore({ storage: memoryStore({ [SETTINGS_KEY]: raw }), capabilities: caps() });
      expect(store.settings.value).toEqual(defaults);
    }
  });

  it('keeps valid stored fields and replaces invalid ones with defaults', () => {
    const raw = JSON.stringify({
      version: SETTINGS_VERSION,
      settings: { sound: true, crt: 'neon', confirmHoldMs: -5, layMode: 'toggle', extra: 1 },
    });
    const store = createSettingsStore({ storage: memoryStore({ [SETTINGS_KEY]: raw }), capabilities: caps() });
    const defaults = defaultSettings(caps());
    expect(store.settings.value).toEqual({ ...defaults, sound: true, layMode: 'toggle' });
  });

  it('keeps the hold duration a whole number of milliseconds', () => {
    const store = createSettingsStore({ storage: memoryStore(), capabilities: caps() });
    store.update({ confirmHoldMs: 1234.9 });
    expect(Number.isInteger(store.settings.value.confirmHoldMs)).toBe(true);
    expect(store.settings.value.confirmHoldMs).toBeLessThanOrEqual(1234.9);
  });

  it('ignores an invalid update instead of storing it', () => {
    const store = createSettingsStore({ storage: memoryStore(), capabilities: caps() });
    const before = store.settings.value;
    store.update({ crt: 'neon' as never, confirmHoldMs: Number.NaN });
    expect(store.settings.value).toEqual(before);
  });

  it('works, in memory, when storage is unavailable or throws', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    for (const storage of [null, throwing]) {
      const store = createSettingsStore({ storage, capabilities: caps() });
      expect(store.settings.value).toEqual(defaultSettings(caps()));
      expect(() => store.update({ sound: true })).not.toThrow();
      expect(store.settings.value.sound).toBe(true);
    }
  });

  describe('coach marks seen (Story 1.12)', () => {
    it('remembers each concept once, across sessions, outside the save', () => {
      const storage = memoryStore();
      const store = createSettingsStore({ storage, capabilities: caps() });
      store.update({ coachMarksSeen: ['lay-egg'] });
      store.update({ coachMarksSeen: [...store.settings.value.coachMarksSeen, 'lay-egg', 'assign'] });
      const again = createSettingsStore({ storage, capabilities: caps() });
      expect([...again.settings.value.coachMarksSeen].sort()).toEqual(['assign', 'lay-egg']);
      expect(Object.isFrozen(again.settings.value.coachMarksSeen)).toBe(true);
    });

    it('drops a stored list that is not a list of concept names', () => {
      for (const bad of ['lay-egg', [1, 2], [''], null]) {
        const raw = JSON.stringify({ version: SETTINGS_VERSION, settings: { sound: true, coachMarksSeen: bad } });
        const store = createSettingsStore({ storage: memoryStore({ [SETTINGS_KEY]: raw }), capabilities: caps() });
        expect(store.settings.value.coachMarksSeen).toEqual([]);
        expect(store.settings.value.sound).toBe(true);
      }
    });

    it('keeps settings written by version 1, before coach marks existed', () => {
      expect(SETTINGS_VERSION).toBeGreaterThan(1);
      const raw = JSON.stringify({ version: 1, settings: { layMode: 'toggle' } });
      const store = createSettingsStore({ storage: memoryStore({ [SETTINGS_KEY]: raw }), capabilities: caps() });
      expect(store.settings.value.layMode).toBe('toggle');
      expect(store.settings.value.coachMarksSeen).toEqual([]);
    });

    it('does not write again when the same concepts are marked seen', () => {
      const storage = memoryStore();
      const store = createSettingsStore({ storage, capabilities: caps() });
      store.update({ coachMarksSeen: ['lay-egg'] });
      const before = store.settings.value;
      store.update({ coachMarksSeen: ['lay-egg'] });
      expect(store.settings.value).toBe(before);
    });
  });

  describe('key bindings (Story 1.27)', () => {
    it('binds every shortcut to its own key by default', () => {
      const keys = Object.values(DEFAULT_KEY_BINDINGS);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
    });

    it('stores a remap, field by field, and reads it back in a later session', () => {
      const storage = memoryStore();
      const store = createSettingsStore({ storage, capabilities: caps() });
      const [first] = Object.keys(DEFAULT_KEY_BINDINGS) as (keyof typeof DEFAULT_KEY_BINDINGS)[];
      store.update({ keyBindings: { ...store.settings.value.keyBindings, [first]: 'q' } });
      expect(store.settings.value.keyBindings[first]).toBe('q');
      expect(Object.isFrozen(store.settings.value.keyBindings)).toBe(true);
      const again = createSettingsStore({ storage, capabilities: caps() });
      expect(again.settings.value.keyBindings).toEqual(store.settings.value.keyBindings);
    });

    it('refuses a binding that gives two shortcuts the same key', () => {
      const store = createSettingsStore({ storage: memoryStore(), capabilities: caps() });
      const before = store.settings.value;
      const [a, b] = Object.keys(DEFAULT_KEY_BINDINGS) as (keyof typeof DEFAULT_KEY_BINDINGS)[];
      store.update({ keyBindings: { ...before.keyBindings, [a]: before.keyBindings[b] } });
      expect(store.settings.value).toBe(before);
    });

    it('drops unknown shortcuts and empty keys from a stored map, keeping the rest', () => {
      const [a, b] = Object.keys(DEFAULT_KEY_BINDINGS) as (keyof typeof DEFAULT_KEY_BINDINGS)[];
      const raw = JSON.stringify({
        version: SETTINGS_VERSION,
        settings: { keyBindings: { [a]: 'q', [b]: '', nonsense: 'z' } },
      });
      const store = createSettingsStore({ storage: memoryStore({ [SETTINGS_KEY]: raw }), capabilities: caps() });
      expect(store.settings.value.keyBindings).toEqual({ ...DEFAULT_KEY_BINDINGS, [a]: 'q' });
    });

    it('keeps settings written by versions 1 and 2, before key bindings existed', () => {
      expect(SETTINGS_VERSION).toBeGreaterThan(2);
      for (const version of [1, 2]) {
        const raw = JSON.stringify({ version, settings: { keyboardShortcuts: false, coachMarksSeen: ['lay-egg'] } });
        const store = createSettingsStore({ storage: memoryStore({ [SETTINGS_KEY]: raw }), capabilities: caps() });
        expect(store.settings.value.keyboardShortcuts).toBe(false);
        expect(store.settings.value.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
      }
    });
  });
});
