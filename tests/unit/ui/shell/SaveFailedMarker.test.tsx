import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { SaveFailedMarker } from '../../../../src/ui/shell/SaveFailedMarker';
import { visibleText } from '../../helpers/a11y';

/**
 * Story 2.2 (UX-DR33): while saving fails the strip shows a persistent
 * `• SAVE FAILED` marker; tapping it explains and offers EXPORT SAVE; it
 * clears after the next successful write.
 */

let sheets: SheetController;
beforeEach(() => {
  sheets = createSheetController();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const marker = () => document.querySelector<HTMLButtonElement>('[data-save-failed]');

describe('save failed marker', () => {
  it('shows only while saving fails, and stays until a write succeeds', () => {
    const failing = signal(false);
    render(
      <>
        <SaveFailedMarker failing={failing} sheets={sheets} onExport={() => {}} />
        <SheetHost sheets={sheets} />
      </>,
    );
    expect(marker()).toBeNull();
    act(() => void (failing.value = true));
    expect(marker()).not.toBeNull();
    expect(visibleText(marker()!)).toBe('• SAVE FAILED');
    act(() => void (failing.value = false));
    expect(marker()).toBeNull();
  });

  it('tapping it explains and offers EXPORT SAVE', () => {
    const failing = signal(true);
    const onExport = vi.fn();
    render(
      <>
        <SaveFailedMarker failing={failing} sheets={sheets} onExport={onExport} />
        <SheetHost sheets={sheets} />
      </>,
    );
    act(() => marker()!.click());
    const sheet = document.querySelector<HTMLElement>('[data-save-failed-sheet]');
    expect(sheet).not.toBeNull();
    expect(visibleText(sheet!)).toContain('SAVE');
    act(() => sheet!.querySelector<HTMLButtonElement>('[data-action="export-save"]')!.click());
    expect(onExport).toHaveBeenCalledTimes(1);
    // A dismissible sheet: it closes like any other.
    act(() => sheet!.querySelector<HTMLButtonElement>('[data-sheet-close]')!.click());
    expect(document.querySelector('[data-save-failed-sheet]')).toBeNull();
    // The marker itself stays: saving still fails.
    expect(marker()).not.toBeNull();
  });
});
