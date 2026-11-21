import { effect, type ReadonlySignal } from '@preact/signals-core';
import type { KeyBindings, Settings, ShortcutId } from '../../platform/settings';
import type { SheetController } from './SheetController';

/**
 * Keyboard shortcuts (Story 1.30; FR47, UX-DR41, ADR 0021).
 *
 * One `keydown` listener on the document acts on the player's bindings
 * (`settings.keyBindings`, remapped on the settings screen, Story 1.27):
 * - `primary` (Space) presses the active tab's primary action, the button in the
 *   visible primary-zone slot (on desktop columns, the one in columns 2–3), exactly as a tap would (`click()`), only when
 *   focus is on the page or on that button. A focused control keeps Space and
 *   Enter (a stepper, a card action, a hold-to-confirm).
 * - `tab1`–`tab5` (1–5) press the Nth tab of the visible tab bar (the rail on desktop).
 * - `pause` (P) calls `pause` (UIRoot's pause toggle). Space no longer pauses.
 * - `close` (Esc) dismisses the open sheet through the SheetController; a
 *   decision sheet is never dismissed (`SheetController.dismiss`).
 *
 * Nothing fires when shortcuts are off in settings, when a modifier (Ctrl, Alt,
 * Meta) is held, on auto-repeat, while typing in a field, while an overlay is
 * up (`overlayHeld`), while a hold or press is in progress (`[data-pressed="true"]`),
 * while a remap listens for its key (`[data-listening="true"]`), or when an
 * earlier handler consumed the key (`defaultPrevented`). While a modal sheet
 * is open, only `close` acts: the colony's keys wait behind the sheet.
 *
 * Settings come in from main as a signal (platform values are never imported here).
 */

export type ShortcutSettings = Pick<Settings, 'keyboardShortcuts' | 'keyBindings'>;

export interface ShortcutDeps {
  settings: ReadonlySignal<ShortcutSettings>;
  sheets: SheetController;
  /** True while an overlay (the phase reveal) blocks input. */
  overlayHeld?: ReadonlySignal<boolean>;
  /** Toggle pause, as the pause button does. */
  pause: () => void;
  /** Where the listener goes and the shell is looked up. Default: `document`. */
  root?: Document;
}

const TAB_SHORTCUTS: readonly ShortcutId[] = ['tab1', 'tab2', 'tab3', 'tab4', 'tab5'];

/** Fields where keys are text. */
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
/** Anything focusable that acts on keys of its own. */
const CONTROL =
  'button, a[href], summary, [role="button"], [role="slider"], [role="spinbutton"], [role="tab"], [role="checkbox"], [role="switch"], [role="radio"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';
/** Keys a focused control uses itself. */
const CONTROL_KEYS = new Set([' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/** The stored form of a key (as Story 1.27 stores bindings): single characters lower case. */
function normalize(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** The shortcut bound to `key`, if any. */
export function shortcutFor(bindings: KeyBindings, key: string): ShortcutId | null {
  const k = normalize(key);
  for (const id of Object.keys(bindings) as ShortcutId[]) if (bindings[id] === k) return id;
  return null;
}

/**
 * The active tab's primary button: the first primary button in the visible slot of the primary zone.
 * On desktop columns (Story 1.29) two slots show; the action is the one in columns 2–3, not NEST's.
 */
export function primaryButton(root: ParentNode): HTMLElement | null {
  const slots = [...root.querySelectorAll<HTMLElement>('[data-primary-zone] > *')].filter((s) => !s.hidden);
  const columns = root.querySelector('[data-shell][data-layout="columns"]') !== null;
  const columnSlot = columns
    ? slots.find((s) => s.hasAttribute('data-primary-for') && s.getAttribute('data-primary-for') !== 'nest')
    : undefined;
  const slot = columnSlot ?? slots[0];
  if (!slot) return null;
  return slot.querySelector<HTMLElement>('button[data-kind="primary"]') ?? slot.querySelector<HTMLElement>('button');
}

function tabButton(root: ParentNode, index: number): HTMLElement | null {
  const bar = root.querySelector<HTMLElement>('[data-tab-bar]');
  if (!bar || bar.hidden) return null;
  return bar.querySelectorAll<HTMLElement>('[data-tab]')[index] ?? null;
}

export function bindShortcuts({ settings, sheets, overlayHeld, pause, root = document }: ShortcutDeps): () => void {
  // Kept current through a signal effect, so a settings change applies to the next key.
  let current = settings.peek();
  const disposeSettings = effect(() => {
    current = settings.value;
  });

  const onKey = (e: KeyboardEvent): void => {
    if (!current.keyboardShortcuts || e.defaultPrevented) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const id = shortcutFor(current.keyBindings, e.key);
    if (!id) return;
    if (overlayHeld?.peek()) return;
    if (root.querySelector('[data-listening="true"], [data-pressed="true"]')) return;

    const focused = root.activeElement instanceof HTMLElement ? root.activeElement : null;
    if (focused?.closest(TYPING)) return;

    const open = sheets.state.peek().open;
    if (id === 'close') {
      if (!open) return;
      e.preventDefault();
      // The drawn sheet has the last word: a `dismissible={false}` sheet stays, whatever its request said.
      if (root.querySelector('[data-sheet][data-dismissible="false"]')) return;
      if (!e.repeat) sheets.dismiss();
      return;
    }
    // Behind an open modal sheet, the colony's keys wait.
    if (open && open.priority !== 'peek') return;

    if (id === 'primary') {
      const btn = primaryButton(root);
      const onControl = focused !== null && focused !== root.body && focused.matches(CONTROL);
      if (onControl && focused !== btn) {
        if (CONTROL_KEYS.has(e.key)) return;
      }
      if (!btn) return;
      // Also stops a focused primary button's own Space click: one press, one action.
      e.preventDefault();
      if (!e.repeat) btn.click();
      return;
    }

    if (focused && focused.matches(CONTROL) && CONTROL_KEYS.has(e.key)) return;
    if (id === 'pause') {
      e.preventDefault();
      if (!e.repeat) pause();
      return;
    }
    const tab = TAB_SHORTCUTS.indexOf(id);
    if (tab >= 0) {
      const btn = tabButton(root, tab);
      if (!btn) return;
      e.preventDefault();
      if (!e.repeat) btn.click();
    }
  };

  root.addEventListener('keydown', onKey);
  return () => {
    root.removeEventListener('keydown', onKey);
    disposeSettings();
  };
}
