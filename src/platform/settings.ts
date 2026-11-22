/**
 * Player settings (Story 1.10, AR12, D4).
 *
 * One signal, stored under its own localStorage key with its own version.
 * Settings are not part of the game save: prestige, loading or importing a
 * save never touches them, and a save export doesn't contain them. There is
 * no game-save migration for them; a settings schema change bumps
 * `SETTINGS_VERSION` here.
 *
 * Version 2 (Story 1.12) added `coachMarksSeen`; version 3 (Story 1.27) added
 * `keyBindings`. Older versions in `READABLE_VERSIONS` are read field by
 * field, so an older file keeps its values and gets each new field's default.
 */
import { computed, signal, type ReadonlySignal } from '@preact/signals-core';
import type { Capabilities } from './capabilities';

export const SETTINGS_KEY = 'the_swarm_settings';
export const SETTINGS_VERSION = 3;
/** Stored versions this build can read; each missing field takes its default. */
const READABLE_VERSIONS: readonly number[] = [1, 2, SETTINGS_VERSION];

/** `os` follows the device's reduced-motion preference. */
export type ReducedMotionSetting = 'os' | 'on' | 'off';
export type CrtMode = 'scene' | 'full' | 'off';
/**
 * Why the CRT effects in effect are OFF though the choice isn't: reduced
 * motion (Story 1.32), or the device at boot (Story 8.4: the OS asks for more
 * contrast or reduced transparency, or the text scale is above 130%).
 */
export type CrtOffReason = 'reducedMotion' | 'device';
/** Text scale above which CRT effects start OFF (Story 8.4, UX-DR36). */
export const CRT_MAX_TEXT_SCALE = 1.3;

/** The device asks for readability over looks: CRT effects start OFF (Story 8.4). */
export function crtOffAtBoot(capabilities: Capabilities): boolean {
  return capabilities.moreContrast || capabilities.reducedTransparency || capabilities.textScale > CRT_MAX_TEXT_SCALE;
}
/** `double` gives decision events twice the time; `off` removes timers. */
export type DecisionTimers = 'normal' | 'double' | 'off';
export type ConfirmStyle = 'hold' | 'twoTaps';
export type LayMode = 'hold' | 'toggle';

/**
 * The keyboard shortcuts (UX-DR41; Story 1.30 acts on them): the active tab's
 * primary action, pause, tabs 1–5 and closing a non-decision sheet. Story 1.27
 * lets the player remap them.
 */
export type ShortcutId = 'primary' | 'pause' | 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5' | 'close';
/** Shortcut → `KeyboardEvent.key` (single characters lower case). No two shortcuts share a key. */
export type KeyBindings = Readonly<Record<ShortcutId, string>>;

/** The default keys, in the order the settings screen lists them. */
export const DEFAULT_KEY_BINDINGS: KeyBindings = Object.freeze({
  primary: ' ',
  pause: 'p',
  tab1: '1',
  tab2: '2',
  tab3: '3',
  tab4: '4',
  tab5: '5',
  close: 'Escape',
});

export interface Settings {
  readonly sound: boolean;
  readonly haptics: boolean;
  readonly reducedMotion: ReducedMotionSetting;
  readonly crt: CrtMode;
  readonly decisionTimers: DecisionTimers;
  readonly confirmStyle: ConfirmStyle;
  /** Hold-to-confirm duration, whole ms. */
  readonly confirmHoldMs: number;
  readonly layMode: LayMode;
  readonly keyboardShortcuts: boolean;
  /** Which key triggers each shortcut (Story 1.27). */
  readonly keyBindings: KeyBindings;
  /** Concepts whose coach mark was shown and dismissed (Story 1.12): each shows once, ever. */
  readonly coachMarksSeen: readonly string[];
}

/** Allowed hold-to-confirm durations, in ms. */
export const CONFIRM_HOLD_MS_RANGE = Object.freeze({ min: 250, max: 5000 });

/** The minimal storage the store needs: `localStorage` fits. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const NO_CONCEPTS: readonly string[] = Object.freeze([]);

export function defaultSettings(capabilities: Capabilities): Settings {
  return Object.freeze({
    sound: false,
    haptics: capabilities.vibrate,
    reducedMotion: 'os',
    crt: 'scene',
    decisionTimers: 'normal',
    confirmStyle: 'hold',
    confirmHoldMs: 1000,
    layMode: 'hold',
    keyboardShortcuts: true,
    keyBindings: DEFAULT_KEY_BINDINGS,
    coachMarksSeen: NO_CONCEPTS,
  });
}

const oneOf =
  <T extends string>(...allowed: T[]) =>
  (v: unknown): v is T =>
    typeof v === 'string' && (allowed as string[]).includes(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isConceptList = (v: unknown): v is readonly string[] =>
  Array.isArray(v) && v.every((c) => typeof c === 'string' && c.length > 0);

const MAX_KEY_LENGTH = 32;
const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_KEY_LENGTH;
const isBindingMap = (v: unknown): v is Partial<Record<ShortcutId, unknown>> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `base` with every known shortcut of `patch` that has a usable key applied.
 * A result where two shortcuts share a key is refused: `base` is kept.
 */
function mergeBindings(base: KeyBindings, patch: Partial<Record<ShortcutId, unknown>>): KeyBindings {
  const next: Record<string, string> = { ...base };
  for (const id of Object.keys(DEFAULT_KEY_BINDINGS) as ShortcutId[]) {
    const key = patch[id];
    if (isKey(key)) next[id] = key;
  }
  const keys = Object.values(next);
  if (new Set(keys).size !== keys.length) return base;
  return Object.freeze(next as unknown as KeyBindings);
}

/** Per-field check; a value that fails it is replaced by the default. */
const VALID: { readonly [K in keyof Settings]: (v: unknown) => boolean } = {
  sound: isBoolean,
  haptics: isBoolean,
  reducedMotion: oneOf<ReducedMotionSetting>('os', 'on', 'off'),
  crt: oneOf<CrtMode>('scene', 'full', 'off'),
  decisionTimers: oneOf<DecisionTimers>('normal', 'double', 'off'),
  confirmStyle: oneOf<ConfirmStyle>('hold', 'twoTaps'),
  confirmHoldMs: (v) =>
    typeof v === 'number' && Number.isFinite(v) && v >= CONFIRM_HOLD_MS_RANGE.min && v <= CONFIRM_HOLD_MS_RANGE.max,
  layMode: oneOf<LayMode>('hold', 'toggle'),
  keyboardShortcuts: isBoolean,
  keyBindings: isBindingMap,
  coachMarksSeen: isConceptList,
};

/** The stored form of a valid field: whole ms, key maps merged onto `base`, concept lists without repeats, frozen. */
function normalize(base: Settings, key: keyof Settings, v: unknown): unknown {
  if (key === 'confirmHoldMs') return Math.floor(v as number);
  if (key === 'keyBindings') return mergeBindings(base.keyBindings, v as Partial<Record<ShortcutId, unknown>>);
  if (key === 'coachMarksSeen') return Object.freeze([...new Set(v as string[])]);
  return v;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  if (isBindingMap(a) && isBindingMap(b)) {
    const ka = Object.keys(a) as ShortcutId[];
    return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
  }
  return a === b;
}

/** `base` with every valid field of `patch` applied; integers stay integers. */
function merge(base: Settings, patch: unknown): Settings {
  if (typeof patch !== 'object' || patch === null) return base;
  const next: Record<string, unknown> = { ...base };
  for (const key of Object.keys(VALID) as (keyof Settings)[]) {
    const v = (patch as Record<string, unknown>)[key];
    if (v !== undefined && VALID[key](v)) next[key] = normalize(base, key, v);
  }
  return Object.freeze(next as unknown as Settings);
}

function read(storage: KeyValueStore | null, defaults: Settings): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return defaults;
    const { version, settings } = data as { version?: unknown; settings?: unknown };
    // Unknown (newer) versions are not guessed at: defaults, until the player changes something.
    if (typeof version !== 'number' || !READABLE_VERSIONS.includes(version)) return defaults;
    return merge(defaults, settings);
  } catch {
    return defaults;
  }
}

export interface SettingsStore {
  /** The one settings signal. */
  readonly settings: ReadonlySignal<Settings>;
  /** Reduced motion in effect: the player's choice, or the OS's when `os`. */
  readonly reducedMotion: ReadonlySignal<boolean>;
  /**
   * CRT effects in effect: the player's choice, but OFF under reduced motion
   * (UX-DR39, Story 1.32), and OFF from boot where the device asks for more
   * contrast, reduced transparency or a text scale above 130% (UX-DR36, Story
   * 8.4) until the player picks a CRT setting in this session.
   */
  readonly crt: ReadonlySignal<CrtMode>;
  /** Why `crt` is OFF though the choice isn't, or null. */
  readonly crtOffBy: ReadonlySignal<CrtOffReason | null>;
  /** Apply the valid fields of `patch` and write them to storage at once. */
  update(patch: Partial<Settings>): void;
}

export interface SettingsDeps {
  /** `localStorage`, or null where it is unavailable (settings then last the session). */
  readonly storage: KeyValueStore | null;
  readonly capabilities: Capabilities;
}

export function createSettingsStore({ storage, capabilities }: SettingsDeps): SettingsStore {
  const settings = signal(read(storage, defaultSettings(capabilities)));
  const reducedMotion = computed(() => {
    const choice = settings.value.reducedMotion;
    return choice === 'os' ? capabilities.reducedMotion : choice === 'on';
  });
  // Session only: the next boot asks the device again.
  const deviceOff = signal(crtOffAtBoot(capabilities));
  const crtOffBy = computed<CrtOffReason | null>(() => {
    if (settings.value.crt === 'off') return null;
    if (reducedMotion.value) return 'reducedMotion';
    return deviceOff.value ? 'device' : null;
  });
  const crt = computed<CrtMode>(() => (crtOffBy.value ? 'off' : settings.value.crt));
  return {
    settings,
    reducedMotion,
    crt,
    crtOffBy,
    update(patch) {
      // Picking a CRT setting, even the stored one, is the player's word over the device's.
      if (VALID.crt((patch as { crt?: unknown } | null)?.crt)) deviceOff.value = false;
      const next = merge(settings.value, patch);
      if ((Object.keys(VALID) as (keyof Settings)[]).every((k) => sameValue(next[k], settings.value[k]))) return;
      settings.value = next;
      try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings: next }));
      } catch {
        // Storage full or blocked: the change still holds for this session.
      }
    },
  };
}
