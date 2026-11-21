import { test, expect, type Page } from '@playwright/test';

/**
 * Story 1.22 (FR1, FR41, UX-DR18, UX-DR30): the NEST tab. Phase 1 reads top to
 * bottom strip, phase line and goal meter, scene, event lines, then `> LAY
 * EGG`; after Phase 1 the primary action follows the next-action rule.
 * Numbers come from the save, never from balance values.
 */

interface Swarm {
  manager: { getState(): { phase: string; stats: { totalEggsLaid: number; totalClicks: number }; upgrades: Record<string, number> } };
  bus: { emit(event: string, payload: unknown): void };
}

async function seed(page: Page, gameState: Record<string, unknown>, settings?: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ([save, prefs]) => {
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'complete');
      if (prefs) localStorage.setItem('the_swarm_settings', prefs);
    },
    [
      JSON.stringify({ version: 15, timestamp: Date.now(), playTimeMs: 0, gameState }),
      settings ? JSON.stringify({ version: 2, settings }) : '',
    ] as const,
  );
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.manager.getState());

const top = async (page: Page, selector: string): Promise<number> => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return box.y;
};

async function tap(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((el) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 }));
  });
}

const EGG_LAYING = {
  phase: 'egg_laying',
  resources: { eggs: 0, larvae: 0, workers: 0, food: 0, nestCapacity: 25, wood: 0, stone: 0, nectar: 0 },
};
const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 5, food: 0, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
  workersAssigned: { gather: 5, tend: 0, dig: 0, guard: 0, researchers: 0 },
};

test.describe('NEST tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('Phase 1 reads strip, phase line and goal meter, scene, event lines, then > LAY EGG', async ({ page }) => {
    await seed(page, EGG_LAYING);
    const order = [
      '[data-resource-strip]',
      '#phase-indicator [data-goal-meter="full"]',
      '[data-nest-scene]',
      '#activity-log .log-entry',
      '[data-primary-zone] #click-egg',
    ];
    for (const sel of order) await expect(page.locator(sel).first()).toBeVisible();
    const ys = [];
    for (const sel of order) ys.push(await top(page, sel));
    for (let i = 1; i < ys.length; i++) expect(ys[i], order[i]).toBeGreaterThan(ys[i - 1]);
    await expect(page.locator('[data-primary-zone] #click-egg')).toContainText('LAY EGG');
    await expect(page.locator('[data-primary-zone] #click-egg [data-prefix]')).toHaveText('> ');
  });

  test('a tap lays eggs through the action with a +N response; a hold repeats', async ({ page }) => {
    await seed(page, EGG_LAYING);
    const before = await state(page);
    await page.locator('#click-egg').click();
    await expect(page.locator('.click-particle').first()).toContainText('+');
    await expect.poll(async () => (await state(page)).stats.totalClicks).toBe(before.stats.totalClicks + 1);

    const afterTap = (await state(page)).stats.totalClicks;
    const btn = page.locator('#click-egg');
    await btn.hover();
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    expect((await state(page)).stats.totalClicks).toBeGreaterThan(afterTap + 1);
  });

  test('toggle lay mode: a tap starts laying, the next tap stops it', async ({ page }) => {
    await seed(page, EGG_LAYING, { layMode: 'toggle' });
    await tap(page, '#click-egg');
    await expect(page.locator('[data-lay-egg][data-laying="true"]')).toBeVisible();
    const start = (await state(page)).stats.totalClicks;
    await expect.poll(async () => (await state(page)).stats.totalClicks).toBeGreaterThan(start + 2);
    await tap(page, '#click-egg');
    await expect(page.locator('[data-lay-egg][data-laying="false"]')).toBeVisible();
    const stopped = (await state(page)).stats.totalClicks;
    await page.waitForTimeout(500);
    expect((await state(page)).stats.totalClicks).toBe(stopped);
  });

  test('the Click Power card appears once affordable and buying it keeps > LAY EGG', async ({ page }) => {
    await seed(page, EGG_LAYING);
    await expect(page.locator('[data-card="click_power"]')).toHaveCount(0);

    await page.goto('about:blank');
    await seed(page, { ...EGG_LAYING, resources: { ...EGG_LAYING.resources, food: 1_000_000 } });
    const card = page.locator('[data-card="click_power"]');
    await expect(card).toBeVisible();
    // Under the event lines.
    expect(await top(page, '[data-card="click_power"]')).toBeGreaterThan(await top(page, '#activity-log'));
    await card.locator('[data-action="buy-click-power"]').click();
    await expect.poll(async () => (await state(page)).upgrades.click_power ?? 0).toBeGreaterThan(0);
    await expect(page.locator('[data-primary-zone] #click-egg')).toBeVisible();
    await expect(page.locator('[data-next-action]')).toHaveCount(0);
  });

  test('event lines: the newest 3, newest "> " first', async ({ page }) => {
    await seed(page, EGG_LAYING);
    await page.evaluate(() => {
      const { bus } = (window as unknown as { __swarm: Swarm }).__swarm;
      for (let i = 1; i <= 5; i++) bus.emit('narrative', { message: `LINE ${i}` });
    });
    const lines = page.locator('#activity-log .log-entry');
    await expect(lines).toHaveCount(3);
    await expect(lines.first()).toHaveText('> LINE 5');
    await expect(lines.nth(1)).toHaveText('· LINE 4');
    for (let i = 0; i < 3; i++) await expect(lines.nth(i)).toBeVisible();
    const colors = await lines.evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
    expect(colors[0]).not.toBe(colors[1]);
  });

  test('below 560 px viewport height only the newest event line shows', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 512 });
    await seed(page, EGG_LAYING);
    await page.evaluate(() => {
      const { bus } = (window as unknown as { __swarm: Swarm }).__swarm;
      for (let i = 1; i <= 3; i++) bus.emit('narrative', { message: `LINE ${i}` });
    });
    const lines = page.locator('#activity-log .log-entry');
    await expect(lines.first()).toBeVisible();
    await expect(lines.nth(1)).toBeHidden();
    await expect(lines.nth(2)).toBeHidden();
  });

  test('after Phase 1 the primary action follows the next-action rule, and the scene still lays eggs', async ({ page }) => {
    await seed(page, COLONY);
    await expect(page.locator('[data-tab-bar]')).toBeVisible();
    const zone = page.locator('[data-primary-for="nest"] [data-next-action]');
    await expect(zone).toBeVisible();
    await expect(zone).toHaveAttribute('data-next-action', 'none');
    await expect(zone).toHaveText(/^NEXT AFFORDABLE: .+ IN ~/);
    await expect(page.locator('[data-primary-zone] #click-egg')).toHaveCount(0);
    // Click Power left NEST for BUILD after Phase 1 (Story 1.24).
    await expect(page.locator('[data-tab-panel="nest"] [data-card="click_power"]')).toHaveCount(0);

    const before = (await state(page)).stats.totalClicks;
    await page.locator('[data-nest-scene] #click-egg').click();
    await expect.poll(async () => (await state(page)).stats.totalClicks).toBeGreaterThan(before);
  });

  test('after Phase 1 an affordable item becomes the primary action and the tap performs it', async ({ page }) => {
    await seed(page, { ...COLONY, resources: { ...COLONY.resources, food: 1_000_000 } });
    const btn = page.locator('[data-primary-for="nest"] [data-action="next-action"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect.poll(async () => Object.values((await state(page)).upgrades).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
