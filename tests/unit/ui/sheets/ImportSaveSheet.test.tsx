import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import {
  IMPORT_CONFIRM_HEADLINE,
  NOT_A_SAVE_HEADLINE,
  openImportConfirm,
  openImportRefused,
} from '../../../../src/ui/sheets/ImportSaveSheet';
import { confirmSettings, holdFor } from '../../helpers/confirm';
import { visibleText } from '../../helpers/a11y';

/**
 * Story 2.11 (UX-DR33): an import that isn't a swarm save shows
 * `THAT FILE ISN'T A SWARM SAVE.` and changes nothing; a valid one asks for a
 * hold-to-confirm that says it replaces the current run.
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

const settings = confirmSettings();
const refused = () => document.querySelector<HTMLElement>('[data-import-refused]');
const confirmSheet = () => document.querySelector<HTMLElement>('[data-import-confirm]');

describe('import refused', () => {
  it('says the file is not a swarm save, and that the run is unchanged', () => {
    act(() => void openImportRefused(sheets, { reason: 'not_a_save' }));
    expect(NOT_A_SAVE_HEADLINE).toBe("THAT FILE ISN'T A SWARM SAVE.");
    expect(visibleText(refused()!.querySelector('[data-sheet-headline]')!)).toBe(NOT_A_SAVE_HEADLINE);
    expect(refused()!.dataset.importRefused).toBe('not_a_save');
    expect(visibleText(refused()!)).toContain('UNCHANGED');
  });

  it('a file from a newer build names both versions', () => {
    act(() => void openImportRefused(sheets, { reason: 'newer_version', version: 99, current: 22 }));
    expect(visibleText(refused()!.querySelector('[data-sheet-headline]')!)).toBe(NOT_A_SAVE_HEADLINE);
    expect(refused()!.dataset.importRefused).toBe('newer_version');
    const text = visibleText(refused()!);
    expect(text).toContain('99');
    expect(text).toContain('22');
  });

  it('offers nothing but closing', () => {
    act(() => void openImportRefused(sheets, { reason: 'not_a_save' }));
    expect([...refused()!.querySelectorAll('button')].filter((b) => !b.hasAttribute('data-sheet-close'))).toHaveLength(0);
    act(() => refused()!.querySelector<HTMLButtonElement>('[data-sheet-close]')!.click());
    expect(refused()).toBeNull();
  });
});

describe('import confirm', () => {
  function open() {
    const onConfirm = vi.fn();
    act(() => void openImportConfirm(sheets, { playTimeMs: 3_600_000, confirmSettings: settings, onConfirm }));
    return onConfirm;
  }
  const replace = () => confirmSheet()!.querySelector<HTMLButtonElement>('[data-action="confirm-import"]')!;

  it('states that it replaces the current run', () => {
    open();
    expect(visibleText(confirmSheet()!.querySelector('[data-sheet-headline]')!)).toBe(IMPORT_CONFIRM_HEADLINE);
    expect(visibleText(confirmSheet()!)).toContain('REPLACES THE CURRENT RUN');
  });

  it('a tap does nothing; a full hold confirms once', () => {
    vi.useFakeTimers();
    const onConfirm = open();
    act(() => replace().click());
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => holdFor(replace(), settings.value.confirmHoldMs + 50));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closing it confirms nothing', () => {
    const onConfirm = open();
    act(() => confirmSheet()!.querySelector<HTMLButtonElement>('[data-sheet-close]')!.click());
    expect(confirmSheet()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
