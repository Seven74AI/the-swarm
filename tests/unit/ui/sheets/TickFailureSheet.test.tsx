import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openTickFailure } from '../../../../src/ui/sheets/TickFailureSheet';

/**
 * Story 1.17: after 3 failed ticks a sheet offers EXPORT SAVE and RELOAD. It
 * can't be closed any other way, and its scrim blocks the colony underneath.
 */

let sheets: SheetController;
beforeEach(() => {
  sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const sheet = () => document.querySelector<HTMLElement>('[data-tick-failure]');
const button = (action: string) => sheet()!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;

describe('tick failure sheet', () => {
  it('opens ahead of every other sheet, as a modal with exactly EXPORT SAVE and RELOAD', () => {
    act(() => void sheets.open({ priority: 'decision', render: () => <p>decision</p> }));
    act(() => void openTickFailure(sheets, { onExport: () => {}, onReload: () => {} }));
    expect(sheets.state.value.open?.priority).toBe('offline');
    expect(sheet()?.getAttribute('role')).toBe('dialog');
    const labels = [...sheet()!.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toHaveLength(2);
    expect(labels.some((t) => t?.includes('EXPORT SAVE'))).toBe(true);
    expect(labels.some((t) => t?.includes('RELOAD'))).toBe(true);
  });

  it('EXPORT SAVE and RELOAD call their handlers and keep the sheet open', () => {
    const onExport = vi.fn();
    const onReload = vi.fn();
    act(() => void openTickFailure(sheets, { onExport, onReload }));
    act(() => button('export-save').click());
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(sheet()).not.toBeNull();
    act(() => button('reload').click());
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed: no CLOSE, Esc and the scrim do nothing, and the scrim blocks taps', () => {
    act(() => void openTickFailure(sheets, { onExport: () => {}, onReload: () => {} }));
    expect(document.querySelector('[data-sheet-close]')).toBeNull();
    act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    // Esc reaches sheets through `SheetController.dismiss` (Story 1.30), which refuses this one.
    act(() => void expect(sheets.dismiss()).toBe(false));
    const scrim = document.querySelector<HTMLElement>('[data-sheet-scrim]')!;
    act(() => scrim.click());
    expect(sheet()).not.toBeNull();
    expect(scrim.hasAttribute('data-passthrough')).toBe(false);
  });
});
