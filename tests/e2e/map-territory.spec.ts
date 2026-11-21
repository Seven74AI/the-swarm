import { test, expect, type Page } from '@playwright/test';
import { createInitialState } from '../../src/state/GameState';
import { openTab } from './helpers/tabs';
import { settleReveals } from './helpers/reveal';

/**
 * #370: tapping a map tile claims it, through the real MapPanel → FrontSegments wiring.
 * `MapPanel.onTileClick` defaults to null (CLAUDE.md gotcha): this is the test that
 * fails if the mount stops assigning it. Runs on desktop and on the touch project.
 *
 * The seed owns the top-left tile; the tile right of it is discovered and free, so
 * claimable. A discovered tile far from any owned one is not.
 */

const GRID = 8;
const ADJACENT = { x: 1, y: 0 };
const FAR = { x: 5, y: 5 };

type Tile = { x: number; y: number; type: string; discovered: boolean; claimed: boolean };

function expansionSave(): string {
  const base = createInitialState();
  const mapTiles: Tile[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const owned = x === 0 && y === 0;
      const open = (x === ADJACENT.x && y === ADJACENT.y) || (x === FAR.x && y === FAR.y);
      mapTiles.push({ x, y, type: open ? 'forest' : 'empty', discovered: owned || open, claimed: owned });
    }
  }
  const gameState = {
    ...base,
    phase: 'expansion',
    resources: { ...base.resources, workers: 60, food: 5_000, nestCapacity: 100, wood: 500, stone: 500, nectar: 100 },
    soldiers: { scouts: 5, warriors: 3, totalKilled: 0 },
    battlesWon: 5,
    mapTiles,
    territory: { ownedTiles: 1, bonuses: {} },
  };
  return JSON.stringify({ version: 18, timestamp: Date.now(), playTimeMs: 0, gameState });
}

type Swarm = { manager: { getState(): { mapTiles: Tile[]; territory: { ownedTiles: number } } } };
const territory = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __swarm: Swarm }).__swarm.manager.getState();
    return { owned: s.territory.ownedTiles, claimed: s.mapTiles.filter((t) => t.claimed).map((t) => `${t.x},${t.y}`) };
  });

async function openMap(page: Page): Promise<void> {
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'done');
  }, expansionSave());
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  await openTab(page, 'front', 'map');
  await expect(page.locator('.map-canvas')).toBeVisible();
  await settleReveals(page);
}

/** Tap (touch project) or click (desktop) the centre of a tile on the map canvas. */
async function pressTile(page: Page, tile: { x: number; y: number }, hasTouch: boolean): Promise<void> {
  const canvas = page.locator('.map-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const position = { x: ((tile.x + 0.5) / GRID) * box.width, y: ((tile.y + 0.5) / GRID) * box.height };
  if (hasTouch) await canvas.tap({ position });
  else await canvas.click({ position });
}

test.describe('Map territory (#370)', () => {
  test('pressing a free tile next to owned territory claims it', async ({ page }, testInfo) => {
    await openMap(page);
    const before = await territory(page);
    expect(before.claimed).toEqual(['0,0']);

    await pressTile(page, ADJACENT, !!testInfo.project.use.hasTouch);

    await expect.poll(async () => (await territory(page)).claimed).toContain(`${ADJACENT.x},${ADJACENT.y}`);
    expect((await territory(page)).owned).toBeGreaterThan(before.owned);
  });

  test('pressing a tile far from owned territory claims nothing', async ({ page }, testInfo) => {
    await openMap(page);
    const before = await territory(page);

    await pressTile(page, FAR, !!testInfo.project.use.hasTouch);
    // Then claim the adjacent one: once that lands, the far press has long been handled.
    await pressTile(page, ADJACENT, !!testInfo.project.use.hasTouch);
    await expect.poll(async () => (await territory(page)).claimed).toContain(`${ADJACENT.x},${ADJACENT.y}`);

    const after = await territory(page);
    expect(after.claimed).not.toContain(`${FAR.x},${FAR.y}`);
    expect(after.owned).toBe(before.owned + 1);
  });
});
