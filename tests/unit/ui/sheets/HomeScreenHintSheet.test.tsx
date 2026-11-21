import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openHomeScreenHint } from '../../../../src/ui/sheets/HomeScreenHintSheet';

/**
 * Story 2.12: a one-time hint explains adding the game to the home screen.
 * It is a dismissible modal that waits behind more urgent sheets.
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

const sheet = () => document.querySelector<HTMLElement>('[data-home-screen-hint]');

describe('home-screen hint sheet', () => {
  it('opens as a dialog that says why the home screen keeps the save', () => {
    act(() => void openHomeScreenHint(sheets));
    expect(sheet()?.getAttribute('role')).toBe('dialog');
    const text = sheet()!.textContent ?? '';
    expect(text).toMatch(/HOME SCREEN/);
    expect(text).toMatch(/7 DAYS/);
  });

  it('waits behind a more urgent sheet', () => {
    act(() => void sheets.open({ priority: 'offline', render: () => <p data-first="">first</p> }));
    act(() => void openHomeScreenHint(sheets));
    expect(sheet()).toBeNull();
    expect(sheets.state.value.queue.length).toBeGreaterThan(0);
  });

  it('closes with its one button', () => {
    act(() => void openHomeScreenHint(sheets));
    const close = sheet()!.querySelector<HTMLButtonElement>('[data-sheet-close]')!;
    expect(close).not.toBeNull();
    act(() => close.click());
    expect(sheet()).toBeNull();
  });
});
