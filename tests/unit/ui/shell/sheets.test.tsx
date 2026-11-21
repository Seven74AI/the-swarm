import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { ModalSheet, PeekSheet, SWIPE_CLOSE_PX } from '../../../../src/ui/shell/Sheet';
import { Button } from '../../../../src/ui/primitives/Button';
import { bindShortcuts } from '../../../../src/ui/shell/shortcuts';
import { DEFAULT_KEY_BINDINGS } from '../../../../src/platform/settings';
import { signal } from '@preact/signals-core';

/**
 * Story 1.14 (UX-DR22): modal and peek sheets drawn by the SheetHost.
 * A modal has a scrim, a handle, a display headline and at most two actions;
 * it closes by swipe down, scrim tap, [ CLOSE ] or Esc (the close shortcut), unless it is a decision
 * sheet. It is a dialog: focus moves to the headline, stays inside, and goes
 * back to the trigger on close.
 */

function q<T extends Element = HTMLElement>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

let sheets: SheetController;
let trigger: HTMLButtonElement;

beforeEach(() => {
  sheets = createSheetController();
  trigger = document.createElement('button');
  trigger.textContent = 'open';
  document.body.appendChild(trigger);
  render(<SheetHost sheets={sheets} />);
  // Esc is the close shortcut (Story 1.30): it goes through the SheetController.
  unbindKeys = bindShortcuts({
    sheets,
    pause: () => {},
    settings: signal({ keyboardShortcuts: true, keyBindings: DEFAULT_KEY_BINDINGS }),
  });
});

let unbindKeys = () => {};

afterEach(() => {
  unbindKeys();
  cleanup();
  document.body.replaceChildren();
});

function openModal(props: { dismissible?: false; action?: boolean; children?: preact.ComponentChildren } = {}) {
  trigger.focus();
  let id = 0;
  act(() => {
    id = sheets.open({
      priority: 'modal',
      render: () =>
        props.dismissible === false ? (
          <ModalSheet headline="BEETLE SIGHTING" dismissible={false}>
            {props.children ?? <button type="button">CHOICE</button>}
          </ModalSheet>
        ) : (
          <ModalSheet
            headline="WELCOME BACK"
            action={props.action ? <Button verb="GO" onPress={() => {}} data-go="" /> : undefined}
          >
            <p>body</p>
          </ModalSheet>
        ),
    });
  });
  return id;
}

describe('ModalSheet', () => {
  it('is a modal dialog labelled by its display headline', () => {
    openModal();
    const dialog = q('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const headline = document.getElementById(dialog.getAttribute('aria-labelledby')!);
    expect(headline?.textContent).toBe('WELCOME BACK');
    expect(headline?.hasAttribute('data-display')).toBe(true);
    expect(dialog.querySelector('[data-sheet-handle]')).not.toBeNull();
    expect(q('[data-sheet-scrim]')).not.toBeNull();
  });

  it('moves focus to the headline on open and back to the trigger on close', () => {
    const id = openModal();
    const headline = q('[data-sheet-headline]');
    expect(document.activeElement).toBe(headline);
    act(() => sheets.close(id));
    expect(q('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('has at most two actions: its own and [ CLOSE ]', () => {
    openModal({ action: true });
    const actions = q('[data-sheet-actions]')!.querySelectorAll('button');
    expect(actions.length).toBeLessThanOrEqual(2);
    expect(q('[data-sheet-close]')?.textContent).toContain('CLOSE');
  });

  it('closes with [ CLOSE ]', () => {
    openModal();
    act(() => q<HTMLButtonElement>('[data-sheet-close]')!.click());
    expect(sheets.state.value.open).toBeNull();
  });

  it('closes on a scrim tap', () => {
    openModal();
    act(() => q('[data-sheet-scrim]')!.click());
    expect(sheets.state.value.open).toBeNull();
  });

  it('closes on Esc', () => {
    openModal();
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    });
    expect(sheets.state.value.open).toBeNull();
  });

  it('closes on a swipe down past the threshold, not on a short one', () => {
    openModal();
    const panel = q('[data-sheet]')!;
    act(() => {
      fireEvent.pointerDown(panel, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerUp(panel, { pointerId: 1, clientY: 300 + SWIPE_CLOSE_PX / 2 });
    });
    expect(sheets.state.value.open).not.toBeNull();
    act(() => {
      fireEvent.pointerDown(panel, { pointerId: 2, button: 0, clientY: 300 });
      fireEvent.pointerMove(panel, { pointerId: 2, clientY: 300 + SWIPE_CLOSE_PX });
      fireEvent.pointerUp(panel, { pointerId: 2, clientY: 300 + SWIPE_CLOSE_PX + 1 });
    });
    expect(sheets.state.value.open).toBeNull();
  });

  it('keeps Tab inside the sheet', () => {
    openModal({ action: true });
    const buttons = [...q('[data-sheet]')!.querySelectorAll<HTMLElement>('button')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back inside when it lands outside', () => {
    openModal();
    act(() => trigger.focus());
    expect(q('[data-sheet]')!.contains(document.activeElement)).toBe(true);
  });

  describe('a decision sheet (not dismissible)', () => {
    it('has no [ CLOSE ] and ignores Esc, scrim taps and swipes', () => {
      openModal({ dismissible: false });
      expect(q('[data-sheet-close]')).toBeNull();
      const panel = q('[data-sheet]')!;
      act(() => {
        fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
        q('[data-sheet-scrim]')!.click();
        fireEvent.pointerDown(panel, { pointerId: 1, button: 0, clientY: 0 });
        fireEvent.pointerUp(panel, { pointerId: 1, clientY: SWIPE_CLOSE_PX * 4 });
      });
      expect(sheets.state.value.open).not.toBeNull();
      expect(q('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    });

    it('lets taps through its scrim, so the colony stays playable behind it', () => {
      openModal({ dismissible: false });
      expect(q('[data-sheet-scrim]')!.hasAttribute('data-passthrough')).toBe(true);
    });
  });
});

describe('PeekSheet', () => {
  function openPeek() {
    act(() => {
      sheets.open({
        priority: 'peek',
        render: () => (
          <PeekSheet header="MEADOW · (5,3)" action={<Button verb="CLAIM" onPress={() => {}} />}>
            <p>tile</p>
          </PeekSheet>
        ),
      });
    });
  }

  it('has no scrim, names its target in the header and has at most two actions', () => {
    openPeek();
    expect(q('[data-sheet-scrim]')).toBeNull();
    const peek = q('[data-sheet="peek"]')!;
    expect(peek.querySelector('[data-sheet-header]')?.textContent).toBe('MEADOW · (5,3)');
    expect(peek.getAttribute('role')).toBe('dialog');
    expect(peek.getAttribute('aria-modal')).toBeNull();
    expect(q('[data-sheet-actions]')!.querySelectorAll('button').length).toBeLessThanOrEqual(2);
  });

  it('closes when a modal opens', () => {
    openPeek();
    openModal();
    expect(q('[data-sheet="peek"]')).toBeNull();
    expect(q('[data-sheet="modal"]')).not.toBeNull();
  });

  it('closes on Esc and [ CLOSE ]', () => {
    openPeek();
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });
    expect(sheets.state.value.open).toBeNull();
    openPeek();
    act(() => q<HTMLButtonElement>('[data-sheet-close]')!.click());
    expect(sheets.state.value.open).toBeNull();
  });
});

describe('SheetHost', () => {
  it('draws only the open sheet, never two modals at once', () => {
    act(() => {
      for (const priority of ['battle', 'offline', 'modal'] as const) {
        sheets.open({ priority, render: () => <ModalSheet headline={priority}>x</ModalSheet> });
      }
    });
    expect(document.querySelectorAll('[data-sheet]')).toHaveLength(1);
    expect(q('[data-sheet-headline]')?.textContent).toBe('offline');
    act(() => q<HTMLButtonElement>('[data-sheet-close]')!.click());
    expect(document.querySelectorAll('[data-sheet]')).toHaveLength(1);
    expect(q('[data-sheet-headline]')?.textContent).toBe('battle');
  });

  it('runs a sheet’s onClose when its own button closes it', () => {
    const onClose = vi.fn();
    act(() => {
      sheets.open({
        priority: 'modal',
        onClose,
        render: (close) => (
          <ModalSheet headline="X" dismissible={false}>
            <button type="button" data-done="" onClick={close}>
              done
            </button>
          </ModalSheet>
        ),
      });
    });
    act(() => q<HTMLButtonElement>('[data-done]')!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(q('[data-sheet]')).toBeNull();
  });
});
