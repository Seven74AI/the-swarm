import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Story 1.29 (FR47 layout, UX-DR6): the same game in columns on desktop.
 * ≥ 1024 px: a 160 px left rail replaces the tab bar, NEST stays in column 1,
 * the active tab fills columns 2–3 (BUILD first), each column with its own
 * primary zone, content at most 1280 px wide, sheets as centered dialogs at
 * most 480 px wide. 600–1023 px: the single column centered at 600 px.
 * Assertions are geometry and visibility only, never balance numbers.
 */

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 16, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Colony below its goal (no guards), so it never latches during the test. */
const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 6, food: 500, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 6, tend: 0, dig: 0, guard: 0, researchers: 0 },
};

const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).boundingBox();
  expect(b, sel).not.toBeNull();
  return b!;
};

const DESKTOP = { width: 1280, height: 800 };

test.describe('Desktop columns (≥ 1024 px)', () => {
  test('a 160 px rail with full names and key hints; NEST in column 1, BUILD in columns 2–3', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seed(page, COLONY);
    const shell = page.locator('[data-shell]');
    await expect(shell).toHaveAttribute('data-layout', 'columns');

    const rail = await box(page, '[data-tab-bar]');
    expect(Math.round(rail.width)).toBe(160);
    expect(rail.x).toBeLessThanOrEqual(1);
    await expect(page.locator('[data-tab="wrkr"]')).toContainText('WORKERS');
    await expect(page.locator('[data-tab="nest"] [data-tab-key]')).toHaveText('1');
    await expect(page.locator('[data-tab="log"] [data-tab-key]')).toHaveText('4');

    const nest = page.locator('[data-tab-panel="nest"]');
    const build = page.locator('[data-tab-panel="build"]');
    await expect(nest).toBeVisible();
    await expect(build).toBeVisible();
    await expect(page.locator('[data-tab-panel="wrkr"]')).toBeHidden();
    const n = await box(page, '[data-tab-panel="nest"]');
    const b = await box(page, '[data-tab-panel="build"]');
    expect(n.x).toBeGreaterThanOrEqual(rail.x + rail.width - 1);
    expect(b.x).toBeGreaterThanOrEqual(n.x + n.width - 1);
    // The goal meter is NEST's full one, so the condensed line stays away.
    await expect(page.locator('[data-goal-line]')).toBeHidden();
  });

  test('each column ends in its own primary zone, at the bottom of the screen', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seed(page, COLONY);
    const nest = await box(page, '[data-tab-panel="nest"]');
    const build = await box(page, '[data-tab-panel="build"]');
    const nestZone = await box(page, '[data-primary-for="nest"]');
    const buildZone = await box(page, '[data-primary-for="build"]');
    for (const [zone, column] of [[nestZone, nest], [buildZone, build]] as const) {
      expect(Math.round(zone.height)).toBe(64);
      expect(zone.y).toBeGreaterThanOrEqual(column.y + column.height - 1);
      expect(zone.y + zone.height).toBeLessThanOrEqual(DESKTOP.height + 1);
      expect(zone.y + zone.height).toBeGreaterThanOrEqual(DESKTOP.height - 1);
      expect(Math.abs(zone.x - column.x)).toBeLessThanOrEqual(1);
    }
    await expect(page.locator('[data-primary-for="nest"] [data-action="next-action"]')).toBeVisible();
  });

  test('picking a tab swaps columns 2–3; picking NEST focuses column 1 and keeps the last tab', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seed(page, COLONY);
    await openTab(page, 'wrkr');
    await expect(page.locator('[data-tab-panel="wrkr"] #worker-assignment')).toBeVisible();
    await expect(page.locator('[data-tab-panel="build"]')).toBeHidden();
    await expect(page.locator('[data-tab-panel="nest"]')).toBeVisible();

    await page.locator('[data-tab="nest"]').click();
    await expect(page.locator('[data-tab="nest"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-tab-panel="nest"]')).toBeFocused();
    await expect(page.locator('[data-tab-panel="wrkr"]')).toBeVisible();
    await expect(page.locator('[data-primary-for="wrkr"]')).toBeVisible();
  });

  test('content is at most 1280 px wide on a wider screen, centered', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await seed(page, COLONY);
    const shell = await box(page, '[data-shell]');
    expect(shell.width).toBeLessThanOrEqual(1280 + 1);
    expect(Math.abs(shell.x - (1600 - shell.width) / 2)).toBeLessThanOrEqual(1);
  });

  test('at 1024 px the columns already apply', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await seed(page, COLONY);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-layout', 'columns');
    await expect(page.locator('[data-tab-panel="build"]')).toBeVisible();
  });

  test('a sheet is a centered dialog at most 480 px wide', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seed(page, COLONY);
    await page.locator('[data-resource-strip]').click();
    const sheet = page.locator('[data-resource-sheet]');
    await expect(sheet).toBeVisible();
    // Wait for the open animation to settle.
    await expect.poll(async () => (await sheet.boundingBox())?.y).toBeLessThan(DESKTOP.height);
    const dialog = page.locator('[data-sheet="modal"]');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    const s = await box(page, '[data-sheet="modal"]');
    expect(s.width).toBeLessThanOrEqual(480 + 1);
    expect(Math.abs(s.x + s.width / 2 - DESKTOP.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(s.y + s.height / 2 - DESKTOP.height / 2)).toBeLessThanOrEqual(2);
  });

  test('Phase 1 is NEST alone: no rail, one column', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seed(page, { phase: 'egg_laying' });
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-layout', 'single');
    await expect(page.locator('[data-tab-bar]')).toBeHidden();
    await expect(page.locator('[data-primary-zone] #click-egg')).toBeVisible();
  });
});

test.describe('Single column below 1024 px', () => {
  test('600–1023 px: the single column, centered at 600 px, with the bottom tab bar', async ({ page }) => {
    const vp = { width: 800, height: 800 };
    await page.setViewportSize(vp);
    await seed(page, COLONY);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-layout', 'single');
    const shell = await box(page, '[data-shell]');
    expect(Math.round(shell.width)).toBe(600);
    expect(Math.abs(shell.x - (vp.width - 600) / 2)).toBeLessThanOrEqual(1);
    const bar = await box(page, '[data-tab-bar]');
    expect(Math.round(bar.width)).toBe(600);
    expect(bar.y + bar.height).toBeLessThanOrEqual(vp.height + 1);
    expect(bar.y).toBeGreaterThanOrEqual(vp.height * 0.6);
    await expect(page.locator('[data-tab="wrkr"]')).toHaveText('WRKR');
    await expect(page.locator('[data-tab-key]')).toHaveCount(0);
    // One tab at a time.
    await expect(page.locator('[data-tab-panel="build"]')).toBeHidden();
    await openTab(page, 'build');
    await expect(page.locator('[data-tab-panel="nest"]')).toBeHidden();
  });

  test('360×640: the phone layout, and sheets stay bottom sheets', async ({ page }) => {
    const vp = { width: 360, height: 640 };
    await page.setViewportSize(vp);
    await seed(page, COLONY);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-layout', 'single');
    await expect(page.locator('[data-tab-bar]')).toBeVisible();
    await expect(page.locator('[data-tab-bar]')).toHaveAttribute('data-rail', 'false');
    await page.locator('[data-resource-strip]').click();
    await expect(page.locator('[data-resource-sheet]')).toBeVisible();
    await expect
      .poll(async () => {
        const s = await page.locator('[data-sheet="modal"]').boundingBox();
        return s ? Math.round(s.y + s.height) : -1;
      })
      .toBeGreaterThanOrEqual(vp.height - 1);
  });

  test('crossing 1024 px switches the layout live', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await seed(page, COLONY);
    await openTab(page, 'log');
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-layout', 'single');
    await page.setViewportSize(DESKTOP);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-layout', 'columns');
    // The last tab picked fills columns 2–3.
    await expect(page.locator('[data-tab-panel="log"]')).toBeVisible();
    await expect(page.locator('[data-tab-panel="nest"]')).toBeVisible();
  });
});
