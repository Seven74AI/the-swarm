import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openUnreadableSave, UNREADABLE_HEADLINE } from '../../../../src/ui/sheets/UnreadableSaveSheet';
import { confirmSettings, holdFor } from '../../helpers/confirm';
import { visibleText } from '../../helpers/a11y';

/**
 * Story 2.2 (UX-DR33): a save that couldn't be read opens
 * `THIS SAVE COULDN'T BE READ.` with LOAD BACKUP and START OVER. It can't be
 * dismissed, and its scrim blocks the game underneath: nothing happens until
 * the player chooses.
 */

let sheets: SheetController;
beforeEach(() => {
  sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

const sheet = () => document.querySelector<HTMLElement>('[data-unreadable-save]');
const button = (action: string) => sheet()!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
const settings = confirmSettings();

function open(over: Partial<Parameters<typeof openUnreadableSave>[1]> = {}) {
  const handlers = { hasBackup: true, onLoadBackup: vi.fn(), onStartOver: vi.fn(), confirmSettings: settings, ...over };
  act(() => void openUnreadableSave(sheets, handlers));
  return handlers;
}

describe('unreadable save sheet', () => {
  it('opens ahead of every other sheet with the headline and exactly LOAD BACKUP and START OVER', () => {
    act(() => void sheets.open({ priority: 'decision', render: () => <p>decision</p> }));
    open();
    expect(sheets.state.value.open?.priority).toBe('offline');
    expect(sheet()?.getAttribute('role')).toBe('dialog');
    expect(visibleText(sheet()!.querySelector('[data-sheet-headline]')!)).toBe(UNREADABLE_HEADLINE);
    expect(UNREADABLE_HEADLINE).toBe("THIS SAVE COULDN'T BE READ.");
    const buttons = [...sheet()!.querySelectorAll('button')];
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.dataset.action)).toEqual(['load-backup', 'start-over']);
  });

  it('LOAD BACKUP calls its handler', () => {
    const h = open();
    act(() => button('load-backup').click());
    expect(h.onLoadBackup).toHaveBeenCalledTimes(1);
    expect(h.onStartOver).not.toHaveBeenCalled();
  });

  it('LOAD BACKUP is disabled with a reason when no backup can be read', () => {
    const h = open({ hasBackup: false });
    expect(button('load-backup').getAttribute('aria-disabled')).toBe('true');
    act(() => button('load-backup').click());
    expect(h.onLoadBackup).not.toHaveBeenCalled();
  });

  it('START OVER is irreversible: a tap does nothing, a full hold starts over', () => {
    vi.useFakeTimers();
    const h = open();
    act(() => button('start-over').click());
    expect(h.onStartOver).not.toHaveBeenCalled();
    act(() => holdFor(button('start-over'), settings.value.confirmHoldMs + 50));
    expect(h.onStartOver).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed, and its scrim blocks taps', () => {
    open();
    expect(document.querySelector('[data-sheet-close]')).toBeNull();
    act(() => void expect(sheets.dismiss()).toBe(false));
    const scrim = document.querySelector<HTMLElement>('[data-sheet-scrim]')!;
    act(() => scrim.click());
    expect(sheet()).not.toBeNull();
    expect(scrim.hasAttribute('data-passthrough')).toBe(false);
  });
});
