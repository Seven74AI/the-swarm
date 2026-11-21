import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../../src/state/GameState';
import { Phase } from '../../../../src/phases/phases';
import { selectEffectiveNestCapacity } from '../../../../src/state/selectors';
import { RESOURCE_BY_ID, STRIP_SETS, type ResourceId } from '../../../../src/ui/shell/resourceCatalog';
import { createResourceFeed, REFRESH_MS, type ResourceFeed } from '../../../../src/ui/shell/resourceFeed';
import { ResourceStrip, STRIP_FLASH_MS } from '../../../../src/ui/shell/ResourceStrip';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { formatStrip } from '../../../../src/utils/format';

/**
 * Story 1.16 (UX-DR7): the resource strip. Per-phase cells with a glyph, a
 * label of at most 4 letters (full word as the accessible name), the value via
 * formatStrip and the delta (no /s, negatives warn with −); capped values warn
 * with ▲; at most 4 refreshes a second; 3 cells plus `+N ▸` at large text;
 * a tap opens the resource sheet.
 */

type Patch = (s: GameState) => GameState;
const write = (patch: Patch) =>
  act(() => {
    gameState.value = patch(gameState.value);
  });
const res =
  (r: Partial<GameState['resources']>, ms = 0): Patch =>
  (s) => ({ ...s, resources: { ...s.resources, ...r }, stats: { ...s.stats, playTimeMs: s.stats.playTimeMs + ms } });

let sheets: SheetController;
let feed: ResourceFeed;

function mount(phase: Phase, patch: Patch = (s) => s, props: { compact?: boolean } = {}) {
  gameState.value = patch({ ...createInitialState(), phase });
  feed = createResourceFeed();
  sheets = createSheetController();
  render(
    <>
      <ResourceStrip feed={feed} sheets={sheets} compact={props.compact ?? false} />
      <SheetHost sheets={sheets} />
    </>,
  );
}

const strip = () => document.querySelector<HTMLElement>('[data-resource-strip]')!;
const cells = () => [...strip().querySelectorAll<HTMLElement>('[data-strip-cell]')];
const cell = (id: ResourceId) => strip().querySelector<HTMLElement>(`[data-strip-cell="${id}"]`)!;
const value = (id: ResourceId) => cell(id).querySelector('[data-value]')!.textContent;
const delta = (id: ResourceId) => cell(id).querySelector<HTMLElement>('[data-delta]')!;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('ResourceStrip', () => {
  it('shows the Phase 1 set, then the Phase 2 set', () => {
    mount(Phase.EGG_LAYING);
    expect(cells().map((c) => c.dataset.stripCell)).toEqual(STRIP_SETS[Phase.EGG_LAYING]);
    cleanup();
    mount(Phase.COLONY);
    expect(cells().map((c) => c.dataset.stripCell)).toEqual(STRIP_SETS[Phase.COLONY]);
  });

  it('gives every cell a glyph, a label of at most 4 letters with the full word as its name, and the strip value', () => {
    mount(Phase.COLONY, res({ food: 123_456, wood: 42 }));
    for (const c of cells()) {
      const id = c.dataset.stripCell as ResourceId;
      const def = RESOURCE_BY_ID[id];
      expect(c.querySelector('[data-glyph]')?.getAttribute('aria-hidden')).toBe('true');
      const label = c.querySelector<HTMLElement>('[data-label]')!;
      expect(label.textContent).toMatch(/^[A-Z]{1,4}$/);
      expect(label.getAttribute('aria-hidden')).toBe('true');
      expect(c.querySelector('[data-name]')?.textContent).toBe(def.name);
      expect(value(id)).toBe(formatStrip(gameState.value.resources[id as keyof GameState['resources']] as number));
      expect(value(id)!.length).toBeLessThanOrEqual(5);
    }
  });

  it('keeps the data-stat hooks on the cells', () => {
    mount(Phase.EGG_LAYING);
    for (const id of STRIP_SETS[Phase.EGG_LAYING]) {
      expect(strip().querySelector(`[data-stat="resources.${id}"] .critical-value`)?.textContent).toBe(value(id));
    }
  });

  it('shows a falling delta as warn with a true minus, a rising one with +, and never /s', () => {
    mount(Phase.COLONY, res({ food: 500, wood: 0 }));
    write(res({ food: 400, wood: 30 }, 2000));
    act(() => {
      vi.advanceTimersByTime(REFRESH_MS);
    });
    expect(delta('food').textContent!.startsWith('−')).toBe(true);
    expect(delta('food').dataset.trend).toBe('down');
    expect(delta('wood').textContent!.startsWith('+')).toBe(true);
    expect(delta('wood').dataset.trend).toBe('up');
    expect(strip().textContent).not.toContain('/s');
  });

  it('marks a capped value warn with ▲', () => {
    const cap = selectEffectiveNestCapacity.value;
    mount(Phase.EGG_LAYING, res({ workers: cap }));
    expect(cell('workers').dataset.capped).toBe('true');
    expect(cell('workers').textContent).toContain('▲');
    expect(cell('food').dataset.capped).toBe('false');
    expect(cell('food').textContent).not.toContain('▲');
  });

  it('refreshes at most 4 times a second, not on every tick', () => {
    mount(Phase.EGG_LAYING, res({ eggs: 1 }));
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      write(res({ eggs: 10 + i }, 50));
      act(() => {
      vi.advanceTimersByTime(50);
    });
      seen.add(value('eggs')!);
    }
    expect(seen.size).toBeLessThanOrEqual(5); // the first value plus at most 4 refreshes in 1 s
    act(() => {
      vi.advanceTimersByTime(REFRESH_MS);
    });
    expect(value('eggs')).toBe(formatStrip(gameState.value.resources.eggs));
  });

  it('at large text shows 3 cells plus a +N ▸ cell, capped or falling first', () => {
    const cap = selectEffectiveNestCapacity.value;
    mount(Phase.COLONY, res({ workers: cap }), { compact: true });
    expect(cells()).toHaveLength(3);
    expect(cells()[0].dataset.stripCell).toBe('workers');
    const more = strip().querySelector<HTMLElement>('[data-strip-more]')!;
    expect(more.textContent).toContain(`+${STRIP_SETS[Phase.COLONY].length - 3}`);
    expect(more.textContent).toContain('▸');
  });

  it('opens the resource sheet on a tap', () => {
    mount(Phase.EGG_LAYING);
    act(() => strip().click());
    expect(sheets.state.value.open?.priority).toBe('modal');
    expect(document.querySelector('[data-resource-sheet]')).not.toBeNull();
  });

  it('stops sampling when unmounted', () => {
    mount(Phase.EGG_LAYING);
    cleanup();
    let updates = 0;
    const stop = feed.snapshot.subscribe(() => updates++);
    updates = 0;
    write(res({ eggs: 77 }, 50));
    act(() => {
      vi.advanceTimersByTime(REFRESH_MS * 4);
    });
    expect(updates).toBe(0);
    stop();
  });
});

describe('a short return flashes the deltas once (Story 2.9, UX-DR43)', () => {
  it('feed.flash() marks the strip for one flash, which then clears', () => {
    mount(Phase.EGG_LAYING);
    expect(strip().hasAttribute('data-flash')).toBe(false);
    act(() => feed.flash());
    expect(strip().hasAttribute('data-flash')).toBe(true);
    act(() => void vi.advanceTimersByTime(STRIP_FLASH_MS));
    expect(strip().hasAttribute('data-flash')).toBe(false);
  });

  it('samples at once, so the deltas that flash already show the time away', () => {
    mount(Phase.EGG_LAYING);
    act(() => void vi.advanceTimersByTime(REFRESH_MS));
    write(res({ eggs: 500 }, 20_000));
    act(() => feed.flash());
    expect(value('eggs')).toBe(formatStrip(500));
  });

  it('a second flash restarts it rather than stacking', () => {
    mount(Phase.EGG_LAYING);
    act(() => feed.flash());
    act(() => void vi.advanceTimersByTime(STRIP_FLASH_MS - 10));
    act(() => feed.flash());
    act(() => void vi.advanceTimersByTime(20));
    expect(strip().hasAttribute('data-flash')).toBe(true);
    act(() => void vi.advanceTimersByTime(STRIP_FLASH_MS));
    expect(strip().hasAttribute('data-flash')).toBe(false);
  });
});
