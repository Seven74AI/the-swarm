import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import fc from 'fast-check';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openOfflineSummary, formatAway, type OfflineSummary } from '../../../../src/ui/sheets/OfflineSummarySheet';
import type { OfflineLoadInfo } from '../../../../src/engine/resume';
import { COLONY_LINES } from '../../../../src/data/content/colonyLines';
import { formatDeltaFull } from '../../../../src/utils/format';
import { PHASE_ORDER } from '../../../../src/phases/phases';
import { createInitialState } from '../../../../src/state/GameState';
import { makeState } from '../../helpers/makeState';
import { visibleText } from '../../helpers/a11y';

/**
 * The offline summary sheet (Story 1.14; Story 2.9: FR23, FR27, UX-DR24).
 * `YOU WERE GONE <time>. THE NEST KEPT WORKING.`, focused on open; the
 * efficiency; gains and losses with glyphs from the before/after states; warn
 * lines (upkeep outran food, the live cap). Only what happened while away:
 * no suggestion of what to do next (playtest 2026-11-22). Legacy hooks `.offline-summary-popup` /
 * `.offline-overlay` stay (offline-progression.spec).
 */

function info(overrides: Partial<OfflineLoadInfo> = {}): OfflineLoadInfo {
  return {
    elapsedMs: 11_640_000, effectiveMs: 11_640_000, offlineTicks: 116_400, efficiency: 0.5,
    capMs: 43_200_000, capped: false, starvedMs: 0, foodRanOutAfterMs: null, starvedEaters: 0, ...overrides,
  };
}

function summary(over: Partial<OfflineSummary> = {}): OfflineSummary {
  const s = createInitialState();
  return {
    info: info(),
    before: { resources: s.resources, combatResources: s.combatResources },
    after: { resources: s.resources, combatResources: s.combatResources },
    ...over,
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
    act(() => void openOfflineSummary(sheets, summary()));
    expect(sheets.state.value.open?.priority).toBe('offline');
    expect(popup()?.getAttribute('role')).toBe('dialog');
    expect(document.querySelector('.offline-overlay')).not.toBeNull();
  });

  it('reads YOU WERE GONE <time>. THE NEST KEPT WORKING. on its headline, which has focus', () => {
    act(() => void openOfflineSummary(sheets, summary({ info: info({ efficiency: 0.75 }) })));
    const head = popup()!.querySelector<HTMLElement>('[data-sheet-headline]')!;
    expect(head.textContent).toBe(`YOU WERE GONE ${formatAway(info().elapsedMs).toUpperCase()}. THE NEST KEPT WORKING.`);
    expect(head.querySelector('.offline-duration')?.textContent).toBe(formatAway(info().elapsedMs).toUpperCase());
    expect(document.activeElement).toBe(head);
    expect(popup()!.querySelector('.offline-efficiency')?.textContent).toContain('75%');
  });

  it('lists every gain and loss from the before/after states, with its glyph; losses in warn with ▼', () => {
    const s = createInitialState();
    const before = { resources: { ...s.resources, food: 500, workers: 10, wood: 7 }, combatResources: s.combatResources };
    const after = { resources: { ...s.resources, food: 1820, workers: 8, wood: 7 }, combatResources: s.combatResources };
    act(() => void openOfflineSummary(sheets, summary({ before, after })));
    const rows = [...popup()!.querySelectorAll<HTMLElement>('[data-offline-change]')];
    expect(rows.map((r) => r.dataset.offlineChange)).toEqual(['workers', 'food']);
    const food = rows.find((r) => r.dataset.offlineChange === 'food')!;
    expect(food.dataset.trend).toBe('up');
    expect(food.querySelector('svg.glyph[aria-hidden="true"]')).not.toBeNull();
    expect(food.textContent).toContain(formatDeltaFull(1320));
    const workers = rows.find((r) => r.dataset.offlineChange === 'workers')!;
    expect(workers.dataset.trend).toBe('down');
    expect(workers.textContent).toContain('▼');
    expect(workers.textContent).toContain(formatDeltaFull(-2));
    // An unchanged stock is not listed.
    expect(popup()!.querySelector('[data-offline-change="wood"]')).toBeNull();
  });

  it('says how long upkeep outran food, in the colony voice', () => {
    act(() => void openOfflineSummary(sheets, summary({ info: info({ starvedMs: 20 * 60_000 }) })));
    const warn = popup()!.querySelector('[data-offline-warn="starved"]');
    expect(warn?.textContent).toBe(COLONY_LINES.offline_starved.text.replace('{time}', formatAway(20 * 60_000).toUpperCase()));
  });

  it('says when the food ran out and how many starved, capped at 20% (Story 9.16)', () => {
    act(() => void openOfflineSummary(sheets, summary({ info: info({ foodRanOutAfterMs: 2 * 3600_000, starvedEaters: 12 }) })));
    const warn = popup()!.querySelector('[data-offline-warn="starved-lost"]');
    expect(warn?.textContent).toBe(
      COLONY_LINES.offline_starved_lost.text.replace('{time}', formatAway(2 * 3600_000).toUpperCase()).replace('{n}', '12').replace('{share}', '20'),
    );
  });

  it('has no starvation-loss line when nobody starved', () => {
    act(() => void openOfflineSummary(sheets, summary({ info: info({ foodRanOutAfterMs: 2 * 3600_000, starvedEaters: 0 }) })));
    expect(popup()!.querySelector('[data-offline-warn="starved-lost"]')).toBeNull();
  });

  it('has no upkeep line when food never ran out', () => {
    act(() => void openOfflineSummary(sheets, summary()));
    expect(popup()!.querySelector('[data-offline-warn="starved"]')).toBeNull();
  });

  it('says the nest stopped growing after the live cap, when the cap was reached (Story 2.4)', () => {
    const capMs = info().capMs;
    act(() => void openOfflineSummary(sheets, summary({ info: info({ elapsedMs: capMs * 2, effectiveMs: capMs, capped: true }) })));
    const cap = popup()!.querySelector('[data-offline-cap]');
    expect(cap).not.toBeNull();
    expect(cap!.getAttribute('data-offline-cap')).toBe(String(capMs));
    expect(cap!.textContent).toBe(COLONY_LINES.offline_cap.text.replace('{cap}', formatAway(capMs).toUpperCase()));
  });

  it('says nothing about the cap when the whole absence was simulated', () => {
    act(() => void openOfflineSummary(sheets, summary()));
    expect(popup()!.querySelector('[data-offline-cap]')).toBeNull();
  });

  it('reports only what happened while away: no next move, no shopping suggestion', () => {
    act(() => void openOfflineSummary(sheets, summary()));
    const buttons = popup()!.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(popup()!.querySelector('[data-sheet-close]')).not.toBeNull();
    expect(popup()!.querySelector('[data-action="offline-next"]')).toBeNull();
    expect(popup()!.querySelector('[data-next-action]')).toBeNull();
    expect(visibleText(popup()!)).not.toMatch(/\bBUY\b|NEXT AFFORDABLE/);
  });

  it('the close button goes back to the nest', () => {
    const onDismiss = vi.fn();
    act(() => void openOfflineSummary(sheets, summary(), { onDismiss }));
    const close = popup()!.querySelector<HTMLButtonElement>('[data-sheet-close]')!;
    expect(close.textContent).toMatch(/back to the nest/i);
    act(() => close.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it('is never empty: it always says how long the player was away and the catch-up efficiency (FR27)', () => {
    act(() => void openOfflineSummary(sheets, summary()));
    expect(visibleText(popup()!.querySelector('[data-sheet-headline]')!)).toMatch(/YOU WERE GONE \S/);
    expect(popup()!.querySelector('.offline-efficiency')!.textContent).toMatch(/\d+%/);
  });

  it('opens ahead of a decision sheet requested at the same time', () => {
    act(() => {
      sheets.open({ priority: 'decision', render: () => null });
      openOfflineSummary(sheets, summary());
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
