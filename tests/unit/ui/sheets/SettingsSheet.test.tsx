import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import type { Capabilities } from '../../../../src/platform/capabilities';
import {
  createSettingsStore,
  SETTINGS_KEY,
  type KeyValueStore,
  type Settings,
  type SettingsStore,
} from '../../../../src/platform/settings';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openSettings, type SettingsScreenDeps } from '../../../../src/ui/sheets/SettingsSheet';

/**
 * Story 1.27 (UX-DR32): the settings screen offers sound, haptics, reduced
 * motion, CRT effects (FULL says contrast is reduced), decision timers,
 * confirm style and hold duration, lay mode, keyboard shortcuts (on/off and
 * remap), replay intro and export diagnostics; no notifications toggle on the
 * web build; every change goes to the settings store at once.
 */

const caps = (over: Partial<Capabilities> = {}): Capabilities => ({
  vibrate: true,
  standalone: false,
  reducedMotion: false,
  moreContrast: false,
  ...over,
});

function memoryStore(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

let sheets: SheetController;
let storage: ReturnType<typeof memoryStore>;
let store: SettingsStore;

function open(over: Partial<SettingsScreenDeps> = {}, capabilities = caps()) {
  storage = memoryStore();
  store = createSettingsStore({ storage, capabilities });
  act(() => void openSettings(sheets, { store, capabilities, onExportDiagnostics: () => {}, onPause: () => {}, ...over }));
}

const sheet = () => document.querySelector<HTMLElement>('[data-settings-sheet]')!;
const row = (key: string) => sheet().querySelector<HTMLElement>(`[data-setting="${key}"]`)!;
const options = (key: string) => [...row(key).querySelectorAll<HTMLButtonElement>('[data-option]')];
const stored = (): Partial<Settings> => JSON.parse(storage.data[SETTINGS_KEY] ?? '{}').settings ?? {};

const CHOICE_ROWS = [
  'sound',
  'haptics',
  'reducedMotion',
  'crt',
  'decisionTimers',
  'confirmStyle',
  'confirmHoldMs',
  'layMode',
  'keyboardShortcuts',
] as const;

beforeEach(() => {
  sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('settings screen', () => {
  it('opens as a modal sheet headed SETTINGS', () => {
    open();
    expect(sheets.state.value.open?.priority).toBe('modal');
    expect(sheet().getAttribute('role')).toBe('dialog');
    expect(sheet().textContent).toContain('SETTINGS');
  });

  it('offers every setting the story lists, each with at least two choices', () => {
    open();
    for (const key of CHOICE_ROWS) {
      expect(row(key), key).not.toBeNull();
      expect(options(key).length, key).toBeGreaterThanOrEqual(2);
    }
    expect(sheet().querySelector('[data-action="replay-intro"]')).not.toBeNull();
    expect(sheet().querySelector('[data-action="export-diagnostics"]')).not.toBeNull();
  });

  it('marks exactly the stored choice of each setting as pressed', () => {
    open();
    for (const key of CHOICE_ROWS) {
      const pressed = options(key).filter((o) => o.getAttribute('aria-pressed') === 'true');
      expect(pressed, key).toHaveLength(1);
      expect(pressed[0].dataset.option, key).toBe(String(store.settings.value[key]));
    }
  });

  it('writes every choice to the settings store and its storage at once', () => {
    open();
    for (const key of CHOICE_ROWS) {
      for (const option of options(key)) {
        act(() => option.click());
        expect(String(store.settings.value[key]), key).toBe(option.dataset.option);
        expect(String(stored()[key]), key).toBe(option.dataset.option);
        expect(option.getAttribute('aria-pressed'), key).toBe('true');
      }
    }
  });

  it('keeps every hold duration it offers inside the range the store accepts', () => {
    open();
    for (const option of options('confirmHoldMs')) {
      act(() => option.click());
      expect(store.settings.value.confirmHoldMs).toBe(Number(option.dataset.option));
    }
  });

  it('says that FULL CRT effects reduce contrast', () => {
    open();
    expect(options('crt').map((o) => o.dataset.option).sort()).toEqual(['full', 'off', 'scene']);
    expect(row('crt').textContent).toMatch(/CONTRAST/);
  });

  it('offers decision timers normal, ×2 and off', () => {
    open();
    expect(options('decisionTimers').map((o) => o.dataset.option).sort()).toEqual(['double', 'normal', 'off']);
    expect(row('decisionTimers').textContent).toContain('×2');
  });

  it('has no notifications toggle on the web build', () => {
    open();
    expect(sheet().querySelector('[data-setting="notifications"]')).toBeNull();
    expect(sheet().textContent).not.toMatch(/NOTIF/i);
  });

  it('says when the device cannot vibrate', () => {
    open({}, caps({ vibrate: false }));
    expect(row('haptics').querySelector('[data-setting-note]')).not.toBeNull();
  });

  describe('keyboard shortcuts', () => {
    const shortcut = (id: string) => sheet().querySelector<HTMLButtonElement>(`[data-shortcut="${id}"]`)!;
    const ids = () => Object.keys(store.settings.value.keyBindings) as (keyof Settings['keyBindings'])[];

    it('lists one remap control per shortcut, showing its key', () => {
      open();
      for (const id of ids()) {
        expect(shortcut(id), id).not.toBeNull();
        expect(shortcut(id).textContent!.trim().length, id).toBeGreaterThan(0);
      }
    });

    it('binds the next key pressed after a tap, and stores it', () => {
      open();
      const [id] = ids();
      act(() => shortcut(id).click());
      expect(shortcut(id).dataset.listening).toBe('true');
      act(() => void fireEvent.keyDown(window, { key: 'Q' }));
      expect(store.settings.value.keyBindings[id]).toBe('q');
      expect(stored().keyBindings?.[id]).toBe('q');
      expect(shortcut(id).dataset.listening).toBe('false');
    });

    it('swaps keys when the new key belongs to another shortcut, so no two share one', () => {
      open();
      const [a, b] = ids();
      const before = store.settings.value.keyBindings;
      act(() => shortcut(a).click());
      act(() => void fireEvent.keyDown(window, { key: before[b] }));
      const after = store.settings.value.keyBindings;
      expect(after[a]).toBe(before[b]);
      expect(after[b]).toBe(before[a]);
      expect(new Set(Object.values(after)).size).toBe(Object.values(after).length);
    });

    it('can bind Escape without closing the sheet, and ignores lone modifier keys', () => {
      open();
      const id = ids().find((i) => store.settings.value.keyBindings[i] !== 'Escape')!;
      act(() => shortcut(id).click());
      act(() => void fireEvent.keyDown(window, { key: 'Shift' }));
      expect(shortcut(id).dataset.listening).toBe('true');
      act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
      expect(sheet()).not.toBeNull();
      expect(store.settings.value.keyBindings[id]).toBe('Escape');
    });
  });

  it('exports diagnostics through the handler main passes in', () => {
    const onExportDiagnostics = vi.fn();
    open({ onExportDiagnostics });
    act(() => sheet().querySelector<HTMLButtonElement>('[data-action="export-diagnostics"]')!.click());
    expect(onExportDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('replays the intro through its handler, and shows it disabled with a reason while there is none', () => {
    open();
    const replay = () => sheet().querySelector<HTMLButtonElement>('[data-action="replay-intro"]')!;
    expect(replay().getAttribute('aria-disabled')).toBe('true');
    act(() => sheets.close(sheets.state.value.open!.id));
    const onReplayIntro = vi.fn();
    open({ onReplayIntro });
    expect(replay().getAttribute('aria-disabled')).not.toBe('true');
    act(() => replay().click());
    expect(onReplayIntro).toHaveBeenCalledTimes(1);
  });

  it('PAUSE (Story 2.10) closes the settings and pauses through the handler main passes in', () => {
    const onPause = vi.fn();
    open({ onPause });
    const pause = sheet().querySelector<HTMLButtonElement>('[data-action="pause"]')!;
    expect(pause.textContent).toContain('PAUSE');
    act(() => pause.click());
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-settings-sheet]')).toBeNull();
  });
});
