import { describe, it, expect, afterEach, vi } from 'vitest';
import type { ComponentChildren } from 'preact';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { Phase } from '../../../../src/phases/phases';
import { createTabShell } from '../../../../src/ui/shell/tabShell';
import { Shell } from '../../../../src/ui/shell/Shell';
import { createSheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { ModalSheet, PeekSheet } from '../../../../src/ui/shell/Sheet';
import { Button } from '../../../../src/ui/primitives/Button';
import { HoldToConfirm } from '../../../../src/ui/primitives/HoldToConfirm';
import { bindShortcuts, type ShortcutSettings } from '../../../../src/ui/shell/shortcuts';
import { DEFAULT_KEY_BINDINGS, type KeyBindings } from '../../../../src/platform/settings';
import { confirmSettings } from '../../helpers/confirm';

/**
 * Story 1.30 (FR47, UX-DR41): keys for the active tab's primary action, the
 * tabs, pause and closing a sheet. They follow the settings (on/off, remaps)
 * and never fire while typing, during a hold, a remap, or an overlay.
 */

function setup(phase: Phase = Phase.COLONY, initial: Partial<ShortcutSettings> = {}, wideAtStart = false) {
  const ph = signal(phase);
  const wide = signal(wideAtStart);
  const shell = createTabShell({ phase: ph, affordable: signal(''), wide });
  const settings = signal<ShortcutSettings>({
    keyboardShortcuts: true,
    keyBindings: DEFAULT_KEY_BINDINGS,
    ...initial,
  });
  const sheets = createSheetController();
  const held = signal(false);
  const pause = vi.fn();
  const primaries: Record<string, ReturnType<typeof vi.fn>> = {};
  const primary: Record<string, ComponentChildren> = {};
  for (const tab of ['nest', 'wrkr', 'build'] as const) {
    const press = vi.fn();
    primaries[tab] = press;
    primary[tab] = <Button variant="primary" verb={`GO ${tab}`} onPress={press} data-test-primary={tab} />;
  }
  render(
    <>
      <Shell shell={shell} views={{ primary }} />
      <SheetHost sheets={sheets} held={held} />
    </>,
  );
  const unbind = bindShortcuts({ settings, sheets, overlayHeld: held, pause });
  const key = (k: string, target: Element = document.activeElement ?? document.body, init: KeyboardEventInit = {}) =>
    act(() => void fireEvent.keyDown(target, { key: k, ...init }));
  return { ph, shell, settings, sheets, held, pause, primaries, unbind, key };
}

let cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups) c();
  cleanups = [];
  cleanup();
  document.body.replaceChildren();
});

function make(phase?: Phase, initial?: Partial<ShortcutSettings>, wide = false) {
  const s = setup(phase, initial, wide);
  cleanups.push(s.unbind);
  return s;
}

function openModal(sheets: ReturnType<typeof createSheetController>, dismissible = true) {
  act(() => {
    sheets.open({
      priority: dismissible ? 'modal' : 'decision',
      render: () =>
        dismissible ? (
          <ModalSheet headline="INFO" data-test-sheet="">
            <p>body</p>
          </ModalSheet>
        ) : (
          <ModalSheet headline="CHOOSE" dismissible={false} data-test-sheet="">
            <button type="button">A</button>
          </ModalSheet>
        ),
    });
  });
}

describe('keyboard shortcuts (Story 1.30)', () => {
  describe('with the default keys', () => {
    it('Space triggers the active tab’s primary action when focus is on the page', () => {
      const { key, primaries } = make();
      key(' ', document.body);
      expect(primaries.nest).toHaveBeenCalledTimes(1);
      expect(primaries.wrkr).not.toHaveBeenCalled();
    });

    it('Space follows the tab: it triggers the primary action of the open tab only', () => {
      const { key, primaries } = make();
      key('2', document.body);
      key(' ', document.body);
      expect(primaries.wrkr).toHaveBeenCalledTimes(1);
      expect(primaries.nest).not.toHaveBeenCalled();
    });

    it('Space on the focused primary button triggers it once (no double fire)', () => {
      const { key, primaries } = make();
      const btn = document.querySelector<HTMLButtonElement>('[data-test-primary="nest"]')!;
      btn.focus();
      key(' ', btn);
      expect(primaries.nest).toHaveBeenCalledTimes(1);
    });

    it('Space on another focused control leaves it to that control', () => {
      const { primaries } = make();
      const other = document.createElement('button');
      document.body.appendChild(other);
      other.focus();
      const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      act(() => void other.dispatchEvent(ev));
      expect(primaries.nest).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(false);
    });

    it('a held key repeats nothing: one press, one action', () => {
      const { key, primaries } = make();
      key(' ', document.body);
      key(' ', document.body, { repeat: true });
      key(' ', document.body, { repeat: true });
      expect(primaries.nest).toHaveBeenCalledTimes(1);
    });

    it('1–5 switch to the tabs in bar order; a tab the phase hides does nothing', () => {
      const { key, shell } = make();
      const order = shell.tabs.value;
      order.forEach((tab, i) => {
        key(String(i + 1), document.body);
        expect(shell.active.value).toBe(tab);
      });
      const before = shell.active.value;
      key(String(order.length + 1), document.body);
      expect(shell.active.value).toBe(before);
    });

    it('tab keys do nothing while the tab bar is hidden (Phase 1)', () => {
      const { key, shell, primaries } = make(Phase.EGG_LAYING);
      key('2', document.body);
      expect(shell.active.value).toBe('nest');
      key(' ', document.body);
      expect(primaries.nest).toHaveBeenCalledTimes(1);
    });

    it('P pauses; Space no longer does', () => {
      const { key, pause } = make();
      key(' ', document.body);
      expect(pause).not.toHaveBeenCalled();
      key('p', document.body);
      expect(pause).toHaveBeenCalledTimes(1);
      key('P', document.body, { shiftKey: true });
      expect(pause).toHaveBeenCalledTimes(2);
    });

    it('Esc closes a dismissible sheet through the SheetController', () => {
      const { key, sheets } = make();
      openModal(sheets);
      expect(sheets.state.value.open).not.toBeNull();
      key('Escape');
      expect(sheets.state.value.open).toBeNull();
    });

    it('Esc closes a peek sheet', () => {
      const { key, sheets } = make();
      act(() => {
        sheets.open({ priority: 'peek', render: () => <PeekSheet header="TILE">x</PeekSheet> });
      });
      key('Escape', document.body);
      expect(sheets.state.value.open).toBeNull();
    });

    it('Esc never closes a decision sheet', () => {
      const { key, sheets } = make();
      openModal(sheets, false);
      key('Escape');
      expect(sheets.state.value.open).not.toBeNull();
    });

    it('while a modal sheet is open, the colony’s keys wait: no primary, tab or pause', () => {
      const { key, sheets, primaries, pause, shell } = make();
      openModal(sheets);
      key(' ');
      key('2');
      key('p');
      expect(primaries.nest).not.toHaveBeenCalled();
      expect(pause).not.toHaveBeenCalled();
      expect(shell.active.value).toBe('nest');
    });

    it('ignores keys with Ctrl, Alt or Meta (browser shortcuts stay the browser’s)', () => {
      const { key, shell, pause } = make();
      key('2', document.body, { ctrlKey: true });
      key('p', document.body, { metaKey: true });
      key('2', document.body, { altKey: true });
      expect(shell.active.value).toBe('nest');
      expect(pause).not.toHaveBeenCalled();
    });

    it('a key another handler already consumed does nothing', () => {
      const { pause } = make();
      const ev = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true });
      ev.preventDefault();
      act(() => void document.body.dispatchEvent(ev));
      expect(pause).not.toHaveBeenCalled();
    });
  });

  describe('on desktop columns (Story 1.29)', () => {
    it('Space triggers the action in columns 2–3, not NEST’s in column 1', () => {
      const { key, primaries, shell } = make(Phase.COLONY, {}, true);
      expect(shell.columns.value).toBe(true);
      const col = shell.columnTab.value!;
      key(' ', document.body);
      expect(primaries[col]).toHaveBeenCalledTimes(1);
      expect(primaries.nest).not.toHaveBeenCalled();
    });

    it('tab keys pick the tab for columns 2–3 through the rail', () => {
      const { key, primaries, shell } = make(Phase.COLONY, {}, true);
      const i = shell.tabs.value.indexOf('wrkr');
      key(String(i + 1), document.body);
      expect(shell.columnTab.value).toBe('wrkr');
      key(' ', document.body);
      expect(primaries.wrkr).toHaveBeenCalledTimes(1);
    });
  });

  describe('never while', () => {
    it('typing in a text field', () => {
      const { key, pause, shell, primaries } = make();
      for (const tag of ['input', 'textarea', 'select'] as const) {
        const field = document.createElement(tag);
        document.body.appendChild(field);
        field.focus();
        key('p', field);
        key('2', field);
        key(' ', field);
      }
      const editable = document.createElement('div');
      editable.contentEditable = 'true';
      document.body.appendChild(editable);
      key('p', editable);
      expect(pause).not.toHaveBeenCalled();
      expect(shell.active.value).toBe('nest');
      expect(primaries.nest).not.toHaveBeenCalled();
    });

    it('an overlay blocks input (the phase reveal)', () => {
      const { key, held, pause, primaries } = make();
      act(() => void (held.value = true));
      key(' ', document.body);
      key('p', document.body);
      expect(pause).not.toHaveBeenCalled();
      expect(primaries.nest).not.toHaveBeenCalled();
    });

    it('a hold is in progress: Space and Enter stay with the hold control', () => {
      const { key, pause, primaries } = make();
      const host = document.createElement('div');
      document.body.appendChild(host);
      const onConfirm = vi.fn();
      render(<HoldToConfirm verb="PRESTIGE" settings={confirmSettings()} onConfirm={onConfirm} />, { container: host });
      const btn = host.querySelector<HTMLButtonElement>('button')!;
      btn.focus();
      key(' ', btn);
      expect(primaries.nest).not.toHaveBeenCalled();
      // Pressed by a pointer, then another key: nothing fires while the hold runs.
      act(() => void fireEvent.pointerDown(btn, { pointerId: 1, button: 0 }));
      key('p', document.body);
      expect(pause).not.toHaveBeenCalled();
    });

    it('a remap is listening for its key', () => {
      const { key, pause } = make();
      const listening = document.createElement('button');
      listening.setAttribute('data-shortcut', 'pause');
      listening.setAttribute('data-listening', 'true');
      document.body.appendChild(listening);
      key('p', document.body);
      expect(pause).not.toHaveBeenCalled();
    });
  });

  describe('the settings', () => {
    it('switched off: no shortcut does anything, Esc included', () => {
      const { key, sheets, pause, shell, primaries } = make(Phase.COLONY, { keyboardShortcuts: false });
      key(' ', document.body);
      key('2', document.body);
      key('p', document.body);
      expect(primaries.nest).not.toHaveBeenCalled();
      expect(shell.active.value).toBe('nest');
      expect(pause).not.toHaveBeenCalled();
      openModal(sheets);
      key('Escape');
      expect(sheets.state.value.open).not.toBeNull();
    });

    it('switched back on at runtime, they work again', () => {
      const { key, settings, pause } = make(Phase.COLONY, { keyboardShortcuts: false });
      key('p', document.body);
      act(() => void (settings.value = { ...settings.value, keyboardShortcuts: true }));
      key('p', document.body);
      expect(pause).toHaveBeenCalledTimes(1);
    });

    it('remapped: the new key acts and the old one does nothing', () => {
      const remapped: KeyBindings = { ...DEFAULT_KEY_BINDINGS, pause: 'k', primary: 'Enter', tab2: 'w', close: 'q' };
      const { key, pause, primaries, shell, sheets } = make(Phase.COLONY, { keyBindings: remapped });
      key('p', document.body);
      expect(pause).not.toHaveBeenCalled();
      key('k', document.body);
      expect(pause).toHaveBeenCalledTimes(1);

      key(' ', document.body);
      expect(primaries.nest).not.toHaveBeenCalled();
      key('Enter', document.body);
      expect(primaries.nest).toHaveBeenCalledTimes(1);

      key('2', document.body);
      expect(shell.active.value).toBe('nest');
      key('W', document.body, { shiftKey: true });
      expect(shell.active.value).toBe('wrkr');

      openModal(sheets);
      key('Escape');
      expect(sheets.state.value.open).not.toBeNull();
      key('q');
      expect(sheets.state.value.open).toBeNull();
    });

    it('unbinding stops every shortcut', () => {
      const { key, pause, unbind } = make();
      unbind();
      key('p', document.body);
      expect(pause).not.toHaveBeenCalled();
    });
  });
});
