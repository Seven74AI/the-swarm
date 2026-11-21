import { useLayoutEffect, useState } from 'preact/hooks';
import type { Capabilities } from '../../platform/capabilities';
import type { KeyBindings, Settings, SettingsStore, ShortcutId } from '../../platform/settings';
import { Button } from '../primitives/Button';
import { ModalSheet } from '../shell/Sheet';
import type { SheetController } from '../shell/SheetController';
import './SettingsSheet.css';

/**
 * The settings screen (Story 1.27; UX-DR32, EXPERIENCE.md → Settings).
 *
 * A modal sheet through the SheetController, opened from the resource sheet's
 * `[ SETTINGS ⚙ ]` (so it works in Phase 1) and from LOG. It reads and writes
 * the settings store main passes in (ui/ never imports platform/ values): each
 * tap calls `store.update` at once, which stores it under the settings key.
 *
 * Rows: sound, haptics, reduced motion, CRT effects (FULL says it lowers
 * contrast), decision timers, confirm style, hold duration, lay mode, keyboard
 * shortcuts on/off and one remap control per shortcut, then REPLAY INTRO and
 * EXPORT DIAGNOSTICS. The web build has no notifications toggle (owner,
 * 2026-11-21). The settings act where their features live: shortcuts in
 * Story 1.30, timers in Story 1.28, CRT in Epic 8, the intro in Story 8.10.
 *
 * Hooks: `[data-settings-sheet]`, `[data-setting=<field>]` with
 * `[data-option=<value>][aria-pressed]` and `[data-setting-note]`,
 * `[data-shortcut=<id>][data-listening]`, `[data-action="replay-intro"|"export-diagnostics"]`.
 */

export interface SettingsScreenDeps {
  /** The settings store (Story 1.10), from main. */
  readonly store: Pick<SettingsStore, 'settings' | 'update'>;
  readonly capabilities: Capabilities;
  /** Download the diagnostics file (main builds it). */
  readonly onExportDiagnostics: () => void;
  /** Play the title cinematic again (Story 8.10). Until it exists the button says why it can't. */
  readonly onReplayIntro?: () => void;
}

export const INTRO_NOT_READY = 'The intro is not in this build yet';

type ChoiceKey = Exclude<keyof Settings, 'keyBindings' | 'coachMarksSeen'>;

interface ChoiceRow<K extends ChoiceKey = ChoiceKey> {
  readonly key: K;
  readonly title: string;
  readonly options: readonly { readonly value: Settings[K]; readonly label: string }[];
  readonly note?: (caps: Capabilities) => string | null;
}

const ON_OFF = [
  { value: true, label: 'ON' },
  { value: false, label: 'OFF' },
] as const;

/** Hold-to-confirm durations offered, ms (inside `CONFIRM_HOLD_MS_RANGE`). */
export const HOLD_DURATIONS_MS = [500, 1000, 1500, 2000, 3000] as const;

const row = <K extends ChoiceKey>(r: ChoiceRow<K>): ChoiceRow => r as unknown as ChoiceRow;

const ROWS: readonly ChoiceRow[] = [
  row({ key: 'sound', title: 'SOUND', options: ON_OFF }),
  row({
    key: 'haptics',
    title: 'HAPTICS',
    options: ON_OFF,
    note: (caps) => (caps.vibrate ? null : 'THIS DEVICE CAN’T VIBRATE.'),
  }),
  row({
    key: 'reducedMotion',
    title: 'REDUCED MOTION',
    options: [
      { value: 'os', label: 'SYSTEM' },
      { value: 'on', label: 'ON' },
      { value: 'off', label: 'OFF' },
    ],
    note: (caps) => `SYSTEM IS ${caps.reducedMotion ? 'ON' : 'OFF'} ON THIS DEVICE.`,
  }),
  row({
    key: 'crt',
    title: 'CRT EFFECTS',
    options: [
      { value: 'scene', label: 'SCENE' },
      { value: 'full', label: 'FULL' },
      { value: 'off', label: 'OFF' },
    ],
    note: () => 'FULL PUTS SCANLINES OVER TEXT TOO: CONTRAST IS REDUCED.',
  }),
  row({
    key: 'decisionTimers',
    title: 'DECISION TIMERS',
    options: [
      { value: 'normal', label: 'NORMAL' },
      { value: 'double', label: '×2' },
      { value: 'off', label: 'OFF' },
    ],
  }),
  row({
    key: 'confirmStyle',
    title: 'CONFIRM',
    options: [
      { value: 'hold', label: 'HOLD' },
      { value: 'twoTaps', label: 'TWO TAPS' },
    ],
  }),
  row({
    key: 'confirmHoldMs',
    title: 'HOLD TIME',
    options: HOLD_DURATIONS_MS.map((ms) => ({ value: ms, label: `${ms / 1000} S` })),
  }),
  row({
    key: 'layMode',
    title: 'LAY EGG',
    options: [
      { value: 'hold', label: 'HOLD' },
      { value: 'toggle', label: 'TOGGLE' },
    ],
  }),
  row({ key: 'keyboardShortcuts', title: 'KEYBOARD SHORTCUTS', options: ON_OFF }),
];

const SHORTCUT_NAMES: Readonly<Record<ShortcutId, string>> = {
  primary: 'PRIMARY ACTION',
  pause: 'PAUSE',
  tab1: 'TAB 1',
  tab2: 'TAB 2',
  tab3: 'TAB 3',
  tab4: 'TAB 4',
  tab5: 'TAB 5',
  close: 'CLOSE SHEET',
};

/** Keys that never become a binding: modifiers alone, and Tab (it moves focus). */
const UNBINDABLE = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'Tab', 'Unidentified', 'Dead']);

/** The stored form of a key: single characters lower case. */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** How a key reads on screen. */
export function keyLabel(key: string): string {
  if (key === ' ') return 'SPACE';
  if (key === 'Escape') return 'ESC';
  return key.toUpperCase();
}

/** `bindings` with `id` on `key`; a shortcut that had `key` takes `id`'s old key, so no two share one. */
export function rebind(bindings: KeyBindings, id: ShortcutId, key: string): KeyBindings {
  const next: Record<string, string> = { ...bindings };
  for (const other of Object.keys(bindings) as ShortcutId[]) {
    if (other !== id && bindings[other] === key) next[other] = bindings[id];
  }
  next[id] = key;
  return next as unknown as KeyBindings;
}

function Choices({ r, store, caps }: { r: ChoiceRow; store: SettingsScreenDeps['store']; caps: Capabilities }) {
  const current = store.settings.value[r.key];
  const titleId = `setting-${r.key}`;
  const note = r.note?.(caps) ?? null;
  return (
    <li class="settings-row" data-setting={r.key}>
      <span class="settings-row__title" id={titleId}>
        {r.title}
      </span>
      <div class="settings-row__options" role="group" aria-labelledby={titleId}>
        {r.options.map((o) => (
          <button
            type="button"
            key={String(o.value)}
            class="settings-option"
            data-option={String(o.value)}
            aria-pressed={o.value === current ? 'true' : 'false'}
            onClick={() => store.update({ [r.key]: o.value } as Partial<Settings>)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {note && (
        <p class="settings-row__note" data-setting-note="">
          {note}
        </p>
      )}
    </li>
  );
}

function ShortcutRemap({ store }: { store: SettingsScreenDeps['store'] }) {
  const bindings = store.settings.value.keyBindings;
  const [listening, setListening] = useState<ShortcutId | null>(null);

  // While a remap waits for its key, the next key press is the binding and goes nowhere else
  // (Esc doesn't close the sheet). Tab and lone modifiers are not bindable. A layout effect, so the
  // listener is in place as soon as the tap has rendered, before a quick key press.
  useLayoutEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setListening(null);
        return;
      }
      if (UNBINDABLE.has(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      store.update({ keyBindings: rebind(store.settings.peek().keyBindings, listening, normalizeKey(e.key)) });
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, store]);

  return (
    <li class="settings-row settings-row--keys" data-setting="keyBindings">
      <span class="settings-row__title">KEYS</span>
      <ul class="settings-keys">
        {(Object.keys(bindings) as ShortcutId[]).map((id) => {
          const waiting = listening === id;
          return (
            <li key={id} class="settings-key">
              <span class="settings-key__name">{SHORTCUT_NAMES[id] ?? id.toUpperCase()}</span>
              <button
                type="button"
                class="settings-option settings-key__key"
                data-shortcut={id}
                data-listening={String(waiting)}
                aria-label={`${SHORTCUT_NAMES[id] ?? id}: ${waiting ? 'press a key' : keyLabel(bindings[id])}. Change`}
                onClick={() => setListening(waiting ? null : id)}
                onBlur={() => waiting && setListening(null)}
              >
                {waiting ? 'PRESS A KEY' : `[ ${keyLabel(bindings[id])} ]`}
              </button>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export function SettingsSheet({ store, capabilities, onExportDiagnostics, onReplayIntro }: SettingsScreenDeps) {
  return (
    <ModalSheet headline="SETTINGS" class="settings-sheet" data-settings-sheet="">
      <ul class="settings-list">
        {ROWS.map((r) => (
          <Choices key={r.key} r={r} store={store} caps={capabilities} />
        ))}
        <ShortcutRemap store={store} />
      </ul>
      <div class="settings-actions">
        <Button
          verb="REPLAY INTRO"
          data-action="replay-intro"
          disabled={onReplayIntro ? false : INTRO_NOT_READY}
          onPress={() => onReplayIntro?.()}
        />
        <Button verb="EXPORT DIAGNOSTICS" data-action="export-diagnostics" onPress={onExportDiagnostics} />
      </div>
    </ModalSheet>
  );
}

/** Request the settings screen; returns its sheet id. */
export function openSettings(sheets: SheetController, deps: SettingsScreenDeps): number {
  return sheets.open({ priority: 'modal', render: () => <SettingsSheet {...deps} /> });
}
