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
    // A cap only where one exists, as a fill meter (Story 9.10).
    expect(cellOf('workers', 'cap')).toMatch(/█.*100%/);
    expect(cellOf('workers', 'cap')).toContain(formatFull(cap));
    expect(rowOf('workers').dataset.capped).toBe('true');
    expect(rowOf('wood').querySelector('[data-col="cap"]')).toBeNull();
    // Food has a cap too since Story 9.15: the food limit.
    expect(rowOf('food').querySelector('[data-col="cap"]')).not.toBeNull();
    for (const r of rows()) expect(r.querySelector('[data-glyph]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('each rate states its own unit, or reads 0 while flat (Story 9.10)', () => {
    open(Phase.SPACE);
    for (const r of rows()) expect(r.querySelector('[data-col="rate"]')!.textContent).toMatch(/^(0|[+−][\d ]+\/[SM])$/);
  });

  it('puts each resource on two lines, and no row shows — (Story 9.10)', () => {
    open(Phase.COLONY);
    for (const r of rows()) {
      const one = r.querySelector('[data-line="1"]')!;
      const two = r.querySelector('[data-line="2"]')!;
      expect(one.querySelector('[data-col="name"]')).not.toBeNull();
      expect(one.querySelector('[data-col="amount"]')).not.toBeNull();
      expect(two.querySelector('[data-col="rate"]')).not.toBeNull();
      expect(two.querySelector('[data-col="source"]')).not.toBeNull();
      expect(r.textContent).not.toContain('—');
    }
  });

  it('past the threshold, groups by tier; a quiet group is collapsed, and its toggle opens it (Story 9.10)', () => {
    open(Phase.SPACE);
    const groups = [...sheet().querySelectorAll<HTMLElement>('[data-resource-group]')];
    expect(groups.length).toBeGreaterThan(1);
    const quiet = groups.find((g) => g.dataset.open === 'false')!;
    expect(quiet).toBeDefined();
    expect(quiet.querySelector('ul')!.hidden).toBe(true);
    act(() => quiet.querySelector<HTMLButtonElement>('[data-action="toggle-group"]')!.click());
    expect(quiet.querySelector('ul')!.hidden).toBe(false);
  });

  it('marks a resource NEW until the sheet closes, then reports the rows it showed (Story 9.10)', () => {
    const onSeen = vi.fn();
    const s = createInitialState();
    gameState.value = { ...s, phase: Phase.COLONY };
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed, { onSeen }));
    expect(rowOf('wood').hasAttribute('data-new')).toBe(true);
    expect(rowOf('food').hasAttribute('data-new')).toBe(false);
    act(() => sheets.close(sheets.state.value.open!.id));
    expect(onSeen).toHaveBeenCalledTimes(1);
    expect(onSeen.mock.calls[0][0]).toEqual(expect.arrayContaining(['wood', 'stone', 'nectar', 'food']));
    // An older save (null) counts everything as seen.
    gameState.value = { ...s, phase: Phase.COLONY, seenResources: null };
    act(() => void openResourceSheet(sheets, feed));
    expect(rows().some((r) => r.hasAttribute('data-new'))).toBe(false);
  });

  it('a tap on a row opens its peek: where it comes from and what spends it (Story 9.10)', () => {
    open(Phase.COLONY);
    expect(sheet().querySelector('[data-resource-peek]')).toBeNull();
    act(() => rowOf('food').querySelector<HTMLButtonElement>('[data-action="resource-peek"]')!.click());
    const peek = sheet().querySelector('[data-resource-peek="food"]')!;
    expect(peek.querySelector('[data-peek="from"]')!.textContent).toMatch(/GATHER/);
    expect(peek.querySelector('[data-peek="spent"]')!.textContent).toMatch(/EAT/);
    expect(rowOf('food').querySelector('[data-action="resource-peek"]')!.getAttribute('aria-expanded')).toBe('true');
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

/** Story 9.11 (FR66, UX-DR50, FR27): the verdict line and what changed since last time. */
describe('resource sheet: am I okay? (Story 9.11)', () => {
  const hungry = (): GameState => {
    const s = createInitialState();
    return { ...s, phase: Phase.COLONY, resources: { ...s.resources, workers: 20, food: 500, nestCapacity: 100 }, workersAssigned: { ...s.workersAssigned, tend: 20 } };
  };

  it('opens with the verdict as its first line; falling reads in warn', async () => {
    const { resetSheetSince } = await import('../../../../src/ui/sheets/sheetSince');
    resetSheetSince();
    gameState.value = hungry();
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed));
    const verdict = sheet().querySelector<HTMLElement>('[data-verdict]')!;
    expect(verdict.dataset.verdict).toBe('food');
    expect(verdict.textContent).toMatch(/^FOOD LASTS /);
    expect(verdict.hasAttribute('data-warn')).toBe(true);
    // First in the sheet's body: before the list.
    expect(verdict.compareDocumentPosition(sheet().querySelector('[data-resource-list]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a tap on the verdict opens the screen that fixes it, only on that tap', async () => {
    const { resetSheetSince } = await import('../../../../src/ui/sheets/sheetSince');
    resetSheetSince();
    const onVerdict = vi.fn();
    gameState.value = hungry();
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed, { onVerdict }));
    expect(onVerdict).not.toHaveBeenCalled();
    act(() => sheet().querySelector<HTMLButtonElement>('[data-verdict]')!.click());
    expect(onVerdict).toHaveBeenCalledWith('food');
    expect(document.querySelector('[data-resource-sheet]')).toBeNull();
  });

  it('the first opening shows no SINCE line; the next one shows the food change and the net rate then and now', async () => {
    const { resetSheetSince } = await import('../../../../src/ui/sheets/sheetSince');
    resetSheetSince();
    gameState.value = hungry();
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed));
    expect(sheet().querySelector('[data-since]')).toBeNull();
    act(() => sheets.close(sheets.state.value.open!.id));
    const s = gameState.value;
    gameState.value = { ...s, resources: { ...s.resources, food: s.resources.food + 1_204 }, workersAssigned: { ...s.workersAssigned, tend: 0, gather: 20 } };
    act(() => void openResourceSheet(sheets, feed));
    const since = sheet().querySelector('[data-since]')!;
    expect(since.textContent).toMatch(/^FOOD \+1\s?204 SINCE \d{2}:\d{2}\W+NET WAS −[\d\s]+\/[SM], NOW \+[\d\s]+\/[SM]$/);
  });
});

/** Story 9.12 (FR66, UX-DR51, FR12): where the food goes. */
describe('resource sheet: the food block (Story 9.12)', () => {
  const colony = (): GameState => {
    const s = createInitialState();
    return { ...s, phase: Phase.COLONY, resources: { ...s.resources, workers: 30, food: 5_000, nestCapacity: 100 }, workersAssigned: { ...s.workersAssigned, gather: 10, tend: 5 } };
  };

  it('sits under the verdict from Colony on: in with its sources, eaten with its eaters, spent this hour, one gatherer feeds', async () => {
    const { foodParts } = await import('../../../../src/systems/ResourceSystem');
    gameState.value = colony();
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed));
    const block = sheet().querySelector<HTMLElement>('[data-food-block]')!;
    expect(sheet().querySelector('[data-verdict]')!.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const p = foodParts(gameState.value);
    expect(block.querySelector('[data-food="in"]')!.textContent).toMatch(/^FOOD IN \+[\d\s]+\/[SM]\W+(from )?gatherers 10\W+idle 15$/);
    expect(block.querySelector('[data-food="eaten"]')!.textContent).toMatch(/^EATEN −[\d\s]+\/[SM]\W+(by )?workers 30\W+soldiers 0$/);
    expect(block.querySelector('[data-food="spent"]')!.textContent).toMatch(/^SPENT THIS HOUR: /);
    expect(block.querySelector('[data-food="feeds"]')!.textContent).toBe(`ONE GATHERER FEEDS ${p.oneGathererFeeds}.`);
  });

  it('a name opens its row in WRKR, or WAR for soldiers', () => {
    const onFoodJump = vi.fn();
    gameState.value = colony();
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed, { onFoodJump }));
    act(() => sheet().querySelector<HTMLButtonElement>('[data-food-jump="gather"]')!.click());
    expect(onFoodJump).toHaveBeenCalledWith('gather');
    act(() => void openResourceSheet(sheets, feed, { onFoodJump }));
    act(() => sheet().querySelector<HTMLButtonElement>('[data-food-jump="soldiers"]')!.click());
    expect(onFoodJump).toHaveBeenLastCalledWith('soldiers');
  });

  it('reads the food limit, FULL IN <t> while food rises, and FULL at the limit (Story 9.15)', async () => {
    const { getFoodLimit } = await import('../../../../src/systems/FoodLimit');
    gameState.value = { ...colony(), resources: { ...colony().resources, food: 0 }, workersAssigned: { ...colony().workersAssigned, gather: 30, tend: 0 } };
    const limit = getFoodLimit(gameState.value);
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed));
    const line = () => sheet().querySelector<HTMLElement>('[data-food="limit"]')!;
    expect(line().textContent).toMatch(new RegExp(`^LIMIT ${formatFull(limit)}\\W+FULL IN \\d`));
    // The separator is decoration: hidden from a screen reader, which hears a pause.
    expect(line().querySelector('[aria-hidden="true"]')?.textContent).toBe('·');
    act(() => void (gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: limit } }));
    act(() => void openResourceSheet(sheets, feed));
    expect(line().textContent).toMatch(/\WFULL$/);
  });

  it('Phase 1 shows no food block', () => {
    gameState.value = createInitialState();
    feed = createResourceFeed();
    act(() => void openResourceSheet(sheets, feed));
    expect(sheet().querySelector('[data-food-block]')).toBeNull();
  });
});
