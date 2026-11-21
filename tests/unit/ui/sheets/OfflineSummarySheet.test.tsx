import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openOfflineSummary, formatAway } from '../../../../src/ui/sheets/OfflineSummarySheet';
import type { OfflineLoadInfo } from '../../../../src/engine/resume';

/**
 * Story 1.14: the legacy OfflineSummaryPopup renders as a sheet through the
 * SheetController, with its old behavior and `.offline-summary-popup` /
 * `.offline-overlay` hooks (offline-progression.spec).
 */

function info(overrides: Partial<OfflineLoadInfo> = {}): OfflineLoadInfo {
  return {
    elapsedMs: 11_640_000, effectiveMs: 11_640_000, offlineTicks: 116_400, efficiency: 0.5,
    capMs: 43_200_000, capped: false, ...overrides,
  };
}

let sheets: SheetController;
beforeEach(() => {
  sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const popup = () => document.querySelector<HTMLElement>('.offline-summary-popup');

describe('offline summary sheet', () => {
  it('opens as the offline-priority modal sheet with the legacy hooks', () => {
    act(() => void openOfflineSummary(sheets, info()));
    expect(sheets.state.value.open?.priority).toBe('offline');
    expect(popup()?.getAttribute('role')).toBe('dialog');
    expect(document.querySelector('.offline-overlay')).not.toBeNull();
  });

  it('tells the player how long they were away, with the time away and the catch-up efficiency', () => {
    act(() => void openOfflineSummary(sheets, info({ efficiency: 0.75 })));
    const text = popup()!.textContent!;
    expect(text).toContain('THE NEST KEPT WORKING.');
    expect(text).toContain('YOU WERE GONE');
    expect(popup()!.querySelector('.offline-duration')?.textContent).toContain(formatAway(info().elapsedMs).toUpperCase());
    expect(popup()!.querySelector('.offline-efficiency')?.textContent).toContain('75%');
  });

  it('has exactly one button, which goes back to the nest and removes sheet and scrim', () => {
    const onDismiss = vi.fn();
    act(() => void openOfflineSummary(sheets, info(), onDismiss));
    const buttons = popup()!.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toMatch(/back to the nest/i);
    act(() => buttons[0].click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
    expect(document.querySelector('.offline-overlay')).toBeNull();
  });

  it('says when the cap stopped the nest, and which cap it was (Story 2.4)', () => {
    const capMs = info().capMs;
    act(() => void openOfflineSummary(sheets, info({ elapsedMs: capMs * 2, effectiveMs: capMs, capped: true })));
    const cap = popup()!.querySelector('[data-offline-cap]');
    expect(cap).not.toBeNull();
    expect(cap!.getAttribute('data-offline-cap')).toBe(String(capMs));
    expect(cap!.textContent).toContain(formatAway(capMs).toUpperCase());
  });

  it('says nothing about the cap when the whole absence was simulated', () => {
    act(() => void openOfflineSummary(sheets, info()));
    expect(popup()!.querySelector('[data-offline-cap]')).toBeNull();
  });

  it('opens ahead of a decision sheet requested at the same time', () => {
    act(() => {
      sheets.open({ priority: 'decision', render: () => null });
      openOfflineSummary(sheets, info());
    });
    expect(popup()).not.toBeNull();
    expect(sheets.state.value.queue.map((s) => s.priority)).toEqual(['decision']);
  });
});

describe('formatAway', () => {
  it('drops zero minor units and never shows hours under an hour', () => {
    expect(formatAway(3 * 3_600_000)).toBe('3h');
    expect(formatAway(3 * 3_600_000 + 14 * 60_000)).toBe('3h 14m');
    expect(formatAway(45 * 60_000)).toBe('45m');
    expect(formatAway(12 * 60_000 + 30_000)).toBe('12m 30s');
    expect(formatAway(45_000)).toBe('45s');
  });
});
