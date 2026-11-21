import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';
import { visibleText } from './helpers/text';

/**
 * Story 1.24 (UX-DR17, UX-DR18): BUILD. Cards with a level change, an effect
 * line and a cost line with the shortfall; the highlighted card's action is
 * the tab's pinned `> BUY`; Click Power lives here from Phase 2; with nothing
 * affordable the header reads `NEXT: <item> IN ~<time>`.
 * No balance numbers here: assertions compare the page with itself.
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
function colony(food: number) {
  return {
    phase: 'colony',
    resources: { eggs: 0, larvae: 0, workers: 6, food, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 6, tend: 0, dig: 0, guard: 0, researchers: 0 },
  };
}

const state = (page: Page) =>
  page.evaluate(() => {
    // @ts-ignore - runs in browser context
    const s = window.__swarm.manager.getState();
    return { clickPower: (s.upgrades.click_power ?? 0) as number, food: s.resources.food as number, walls: s.buildings.walls.level as number };
  });

test.describe('BUILD tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('in Colony, nothing affordable: the header names what comes next and > BUY is empty', async ({ page }) => {
    // Food comes in from the gatherers, so the price must stay out of reach for the
    // whole test: a high Click Power level, not an empty larder, keeps it unaffordable.
    await seed(page, { ...colony(0), upgrades: { click_power: 40 } });
    await openTab(page, 'build');
    const build = page.locator('[data-tab-panel="build"]');
    await expect(build.locator('[data-build-header]')).toHaveText(/^NEXT: CLICK POWER IN ~/);
    const card = build.locator('[data-card="click_power"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-shortfall]')).toContainText('needs');
    await expect(card.locator('[data-action="buy-click-power"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-primary-for="build"] [data-action="buy-highlighted"]')).toHaveCount(0);
    // No buildings in Colony yet (Stories 3.4/3.5).
    await expect(page.locator('#building-panel')).toHaveCount(0);
  });

  test('the highlighted card is the one > BUY buys', async ({ page }) => {
    await seed(page, colony(1_000_000));
    await openTab(page, 'build');
    const build = page.locator('[data-tab-panel="build"]');
    await expect(build.locator('[data-build-header]')).toHaveText('BUILD');
    const card = build.locator('[data-card="click_power"]');
    await expect(card).toHaveAttribute('data-selected', '');
    await expect(build.locator('[data-card][data-selected]')).toHaveCount(1);

    const primary = page.locator('[data-primary-for="build"] [data-action="buy-highlighted"]');
    await expect(primary).toBeVisible();
    await expect(primary).toContainText('BUY');
    await expect(primary).toContainText('CLICK POWER');
    const before = await state(page);
    await primary.click();
    await expect.poll(async () => (await state(page)).clickPower).toBeGreaterThan(before.clickPower);
    await expect.poll(() => visibleText(card.locator('.card__level'))).toContain(`LV.${before.clickPower + 1} →`);
  });

  test('in Expansion the building cards show level change, effect and cost; > BUY follows the highlight', async ({ page }) => {
    await seed(page, {
      phase: 'expansion',
      resources: { eggs: 0, larvae: 0, workers: 10, food: 0, nestCapacity: 1000, wood: 0, stone: 1_000_000, nectar: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      // Every worker has a role that makes no food: unassigned workers forage, and
      // the food they bring in would soon afford Click Power and move the highlight.
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 10, researchers: 0 },
    });
    await openTab(page, 'build');
    const walls = page.locator('[data-building="walls"]');
    await expect.poll(() => visibleText(walls.locator('.card__level'))).toBe('LV.0 → 1');
    await expect(walls.locator('.card__effect')).toContainText('DEFENSE');
    await expect(walls.locator('.card__cost')).not.toHaveText('');
    // Stone only: Walls is the one affordable building, so it is highlighted.
    await expect(walls.locator('[data-card]')).toHaveAttribute('data-selected', '');
    await expect(page.locator('[data-building="barracks"] [data-shortfall]')).toContainText('needs');

    const primary = page.locator('[data-primary-for="build"] [data-action="buy-highlighted"]');
    await expect(primary).toContainText('WALLS');
    await primary.click();
    await expect.poll(async () => (await state(page)).walls).toBeGreaterThan(0);
    await expect.poll(() => visibleText(walls.locator('.card__level'))).toBe('LV.1 → 2');
  });
});
