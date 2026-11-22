import { test, expect, type Page } from '@playwright/test';
import { settleReveals } from './helpers/reveal';
import { openTab } from './helpers/tabs';
import { sceneBalance } from '../../src/data/balance/scene';

/**
 * Story 1.22 (FR1, FR41, UX-DR18, UX-DR30): the NEST tab. Phase 1 reads top to
 * bottom strip, phase line and goal meter, scene, event lines, then `> LAY
 * EGG`; after Phase 1 the primary action follows the next-action rule.
 * Numbers come from the save, never from balance values.
 */

interface Swarm {
  manager: { getState(): { phase: string; stats: { totalEggsLaid: number; totalClicks: number; playTimeMs: number }; upgrades: Record<string, number> } };
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
  await settleReveals(page);
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

  test('a staggered panel reveal never jumps LAY EGG down after it is drawn', async ({ page }) => {
    // A reveal with an animation-delay must hold its start pose during the delay;
    // showing the button in place and then snapping it 30px down moved it from under
    // a thumb (and made the hold test below flaky).
    await page.addInitScript(() => {
      const ys: number[] = [];
      (window as unknown as { __eggYs: number[] }).__eggYs = ys;
      const t0 = performance.now();
      const sample = () => {
        const el = document.querySelector('#click-egg');
        if (el && el.getClientRects().length) ys.push(el.getBoundingClientRect().y);
        if (performance.now() - t0 < 2500) requestAnimationFrame(sample);
        else (window as unknown as { __eggDone: boolean }).__eggDone = true;
      };
      requestAnimationFrame(sample);
    });
    await seed(page, EGG_LAYING);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __eggYs: number[] }).__eggYs.length), { timeout: 5000 }).toBeGreaterThan(30);
    // Sample the whole 2.5 s window: the reveals finish inside it.
    await page.waitForFunction(() => (window as unknown as { __eggDone?: boolean }).__eggDone === true);
    const ys = await page.evaluate(() => (window as unknown as { __eggYs: number[] }).__eggYs);
    for (let i = 1; i < ys.length; i++) expect(ys[i], `frame ${i}: ${ys[i - 1]} → ${ys[i]}`).toBeLessThanOrEqual(ys[i - 1] + 0.5);
  });

  test('switching tabs never replays the panel reveal', async ({ page }) => {
    await seed(page, COLONY);
    await openTab(page, 'wrkr');
    await openTab(page, 'nest');
    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target?.matches('.panel-revealed')).length,
    );
    expect(running).toBe(0);
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
    await expect.poll(async () => (await state(page)).stats.totalClicks, { timeout: 5000 }).toBeGreaterThan(afterTap + 1);
    await page.mouse.up();
  });

  test('toggle lay mode: a tap starts laying, the next tap stops it', async ({ page }) => {
    await seed(page, EGG_LAYING, { layMode: 'toggle' });
    await tap(page, '#click-egg');
    await expect(page.locator('[data-lay-egg][data-laying="true"]')).toBeVisible();
    const start = (await state(page)).stats.totalClicks;
    await expect.poll(async () => (await state(page)).stats.totalClicks).toBeGreaterThan(start + 2);
    await tap(page, '#click-egg');
    await expect(page.locator('[data-lay-egg][data-laying="false"]')).toBeVisible();
    const stopped = await state(page);
    // Let at least 500 ms of game time pass (ticks, not the wall clock), then nothing more was laid.
    await expect
      .poll(async () => (await state(page)).stats.playTimeMs)
      .toBeGreaterThanOrEqual(stopped.stats.playTimeMs + 500);
    expect((await state(page)).stats.totalClicks).toBe(stopped.stats.totalClicks);
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

  test('Phase 1 sells more than Click Power: each egg-chamber card buys its upgrade and keeps > LAY EGG (Story 4.6)', async ({ page }) => {
    await seed(page, { ...EGG_LAYING, resources: { ...EGG_LAYING.resources, food: 1_000_000 } });
    const cards = page.locator('[data-nest-host="click-power"] [data-card]');
    // Click Power plus at least three egg-chamber upgrades, all priced in food.
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
    const ids = await page.locator('[data-action="buy-upgrade"]').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.upgrade!));
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) {
      const before = await state(page);
      await page.locator(`[data-action="buy-upgrade"][data-upgrade="${id}"]`).click();
      await expect.poll(async () => (await state(page)).upgrades[id] ?? 0).toBeGreaterThan(before.upgrades[id] ?? 0);
    }
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
    // Freeze the game clock: with gatherers working, an item becomes affordable within
    // about a second, so the 'none' line is only stable while no ticks run.
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
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
    await page.clock.runFor(200); // let a few ticks apply the tap
    await expect.poll(async () => (await state(page)).stats.totalClicks).toBeGreaterThan(before);
  });

  test('after Phase 1 an affordable item becomes the primary action and the tap performs it', async ({ page }) => {
    await seed(page, { ...COLONY, resources: { ...COLONY.resources, food: 1_000_000 } });
    const btn = page.locator('[data-primary-for="nest"] [data-action="next-action"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect.poll(async () => Object.values((await state(page)).upgrades).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  test('the nest scene draws the colony, labels its exact counts, and each chamber opens its peek sheet (Story 8.5)', async ({ page }) => {
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await seed(page, { ...COLONY, resources: { ...COLONY.resources, eggs: 3, larvae: 2 }, eggPipeline: { count: 3, progress: 0 }, larvaPipeline: { count: 2, progress: 0 } });
    const scene = page.locator('[data-nest-scene] [data-scene="nest"]');
    await expect(scene).toBeVisible();
    for (const part of ['soil', 'grass', 'tunnel', 'chamber', 'queen', 'worker']) {
      await expect(scene.locator(`svg [data-scene-part="${part}"]`).first()).toBeAttached();
    }
    const r = (await page.evaluate(() =>
      (window as unknown as { __swarm: { manager: { getState(): { resources: Record<string, number> } } } }).__swarm.manager.getState().resources,
    )) as Record<string, number>;
    const [workers, eggs, larvae] = [r.workers, r.eggs, r.larvae].map(Math.floor);
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    await expect(scene).toHaveAttribute('aria-label', `Nest: ${n(workers, 'worker', 'workers')}, ${n(eggs, 'egg', 'eggs')}, ${n(larvae, 'larva', 'larvae')}`);

    await scene.getByRole('button', { name: /^Brood:/ }).click();
    const brood = page.locator('[data-sheet="peek"][data-chamber-peek="brood"]');
    await expect(brood).toBeVisible();
    await expect(brood.locator('[data-chamber-count="eggs"]')).toHaveText(String(eggs));
    await expect(brood.locator('[data-chamber-count="larvae"]')).toHaveText(String(larvae));
    // A newer peek replaces it.
    await scene.getByRole('button', { name: /^Workers:/ }).click();
    const peek = page.locator('[data-sheet="peek"][data-chamber-peek="workers"]');
    await expect(peek).toBeVisible();
    await expect(brood).toHaveCount(0);
    await expect(peek.locator('[data-chamber-count="workers"]')).toHaveText(String(workers));
    await peek.locator('[data-sheet-close]').click();
    await expect(peek).toHaveCount(0);
  });

  // Story 8.6 (AR14): thousands of ants draw as a dot cloud under at most the budget of moving ants.
  const BIG = {
    ...COLONY,
    resources: { ...COLONY.resources, workers: 4_000, eggs: 900, larvae: 400, food: 1_000_000, nestCapacity: 100_000 },
    workersAssigned: { gather: 4_000, tend: 0, dig: 0, guard: 0, researchers: 0 },
    eggPipeline: { count: 900, progress: 0 },
    larvaPipeline: { count: 400, progress: 0 },
  };
  const antTransforms = (page: Page) =>
    page.locator('[data-scene="nest"] [data-scene-part="worker"]').evaluateAll((els) => els.map((e) => e.getAttribute('transform')));

  test('a colony of thousands draws a dot cloud with at most the budget of ants, and they move (Story 8.6)', async ({ page }) => {
    await seed(page, BIG);
    const scene = page.locator('[data-nest-scene] [data-scene="nest"]');
    await expect(scene.locator('svg [data-scene-part="cloud"][data-cloud="workers"]')).toBeAttached();
    await expect(scene.locator('svg [data-scene-part="cloud"][data-cloud="brood"]')).toBeAttached();
    const ants = await scene.locator('[data-scene-part="worker"]').count();
    expect(ants).toBeGreaterThanOrEqual(sceneBalance.cloudAntsMin);
    expect(ants).toBeLessThanOrEqual(sceneBalance.animatedAntsMax);
    const before = await antTransforms(page);
    await expect.poll(() => antTransforms(page)).not.toEqual(before);
  });

  test('under reduced motion the ants hold still (Story 8.6)', async ({ page }) => {
    await seed(page, BIG, { reducedMotion: 'on' });
    await expect(page.locator('[data-scene="nest"] [data-scene-part="cloud"]').first()).toBeAttached();
    const before = await antTransforms(page);
    expect(before.length).toBeGreaterThan(0);
    // Many frames go by: a running loop would have moved them.
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          let frames = 0;
          const next = () => (++frames >= 30 ? done() : requestAnimationFrame(next));
          requestAnimationFrame(next);
        }),
    );
    expect(await antTransforms(page)).toEqual(before);
  });
});
