import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../../src/state/GameState';
import { Phase } from '../../../../src/phases/phases';
import { selectEffectiveNestCapacity } from '../../../../src/state/selectors';
import { RESOURCES, RESOURCE_BY_ID, type ResourceId } from '../../../../src/ui/shell/resourceCatalog';
import { createResourceFeed, type ResourceFeed } from '../../../../src/ui/shell/resourceFeed';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openResourceSheet } from '../../../../src/ui/sheets/ResourceSheet';
import { formatFull } from '../../../../src/utils/format';

/**
 * Story 1.16 (UX-DR8): the resource sheet lists every unlocked resource with
 * its glyph, full name, exact integer (formatFull), rate (unit stated once in
 * the header), cap and source, and ends with [ SETTINGS gear ].
 */

let sheets: SheetController;
let feed: ResourceFeed;

function open(phase: Phase, resources: Partial<GameState['resources']> = {}, onOpenSettings?: () => void) {
  const s = createInitialState();
  gameState.value = { ...s, phase, resources: { ...s.resources, ...resources } };
  feed = createResourceFeed();
  act(() => void openResourceSheet(sheets, feed, { onOpenSettings }));
}

const sheet = () => document.querySelector<HTMLElement>('[data-resource-sheet]')!;
const rows = () => [...sheet().querySelectorAll<HTMLElement>('[data-resource-row]')];
const rowOf = (id: ResourceId) => sheet().querySelector<HTMLElement>(`[data-resource-row="${id}"]`)!;
const cellOf = (id: ResourceId, col: string) => rowOf(id).querySelector(`[data-col="${col}"]`)!.textContent;

beforeEach(() => {
  sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('resource sheet', () => {
  it('opens as a modal sheet', () => {
    open(Phase.EGG_LAYING);
    expect(sheets.state.value.open?.priority).toBe('modal');
    expect(sheet().getAttribute('role')).toBe('dialog');
  });

  it('lists every unlocked resource and no locked one', () => {
    for (const phase of [Phase.EGG_LAYING, Phase.COLONY, Phase.SPACE]) {
      open(phase);
      const unlocked = feed.snapshot.value.rows.filter((r) => r.unlocked).map((r) => r.id);
      expect(rows().map((r) => r.dataset.resourceRow)).toEqual(unlocked);
      act(() => sheets.close(sheets.state.value.open!.id));
    }
  });

  it('shows the full name, the exact integer, the cap and the source', () => {
    const cap = selectEffectiveNestCapacity.value;
    open(Phase.COLONY, { food: 1_234_567 - 1_000_000, workers: cap, wood: 98_765 });
    for (const id of ['food', 'wood', 'workers'] as const) {
      expect(cellOf(id, 'name')).toBe(RESOURCE_BY_ID[id].name);
      expect(cellOf(id, 'amount')).toBe(formatFull(gameState.value.resources[id]));
      expect(cellOf(id, 'source')).toBe(RESOURCE_BY_ID[id].source);
    }
    expect(cellOf('workers', 'cap')).toBe(formatFull(cap));
    expect(rowOf('workers').dataset.capped).toBe('true');
    expect(cellOf('food', 'cap')).not.toMatch(/\d/);
    for (const r of rows()) expect(r.querySelector('[data-glyph]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('states the rate unit once, in the header', () => {
    open(Phase.SPACE);
    const text = sheet().textContent!;
    expect(text.split('/s').length - 1).toBe(1);
    expect(sheet().querySelector('[data-resource-header]')!.textContent).toContain('/s');
    for (const r of rows()) expect(r.querySelector('[data-col="rate"]')!.textContent).not.toContain('/');
  });

  it('ends with [ SETTINGS gear ] after the list, which closes the sheet and opens settings', () => {
    const onOpenSettings = vi.fn();
    open(Phase.EGG_LAYING, {}, onOpenSettings);
    const settings = sheet().querySelector<HTMLButtonElement>('[data-action="settings"]')!;
    expect(settings.textContent).toContain('SETTINGS');
    const list = sheet().querySelector('[data-resource-list]')!;
    expect(list.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => settings.click());
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-resource-sheet]')).toBeNull();
  });

  it('keeps the settings button visible (disabled with a reason) before a settings screen exists', () => {
    open(Phase.EGG_LAYING);
    const settings = sheet().querySelector<HTMLButtonElement>('[data-action="settings"]')!;
    expect(settings.getAttribute('aria-disabled')).toBe('true');
  });

  it('has a row for each catalog resource once everything is unlocked', () => {
    open(Phase.TRANSCENDENCE);
    expect(rows()).toHaveLength(RESOURCES.length);
  });
});
