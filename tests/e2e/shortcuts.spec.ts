import { test, expect, type Page } from '@playwright/test';

/**
 * Story 1.30 (FR47, UX-DR41): keyboard shortcuts. Space presses the active
 * tab's primary action, 1–5 switch tabs, P pauses (Space no longer does), Esc
 * closes a non-decision sheet. They follow the settings: switched off they do
 * nothing; remapped, the new key acts. Invariants only, no balance numbers.
 */

type Bindings = Record<string, string>;

const eggsLaid = (page: Page) =>
  page.evaluate(() => (window as any).__swarm.manager.getState().stats.totalEggsLaid as number);

async function boot(page: Page, opts: { gameState?: Record<string, unknown>; settings?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    ({ save, settings }) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_onboarding', 'done');
      if (save) localStorage.setItem('the_swarm_save', save);
      if (settings) localStorage.setItem('the_swarm_settings', JSON.stringify({ version: 3, settings }));
    },
    {
      save: opts.gameState
        ? JSON.stringify({ version: 17, timestamp: Date.now(), playTimeMs: 0, gameState: opts.gameState })
        : null,
      settings: opts.settings ?? null,
    },
  );
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Colony below its goal, so it never latches during a test. */
const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 8, food: 500, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 3, tend: 0, dig: 0, guard: 0, researchers: 0 },
};

const activeTab = (page: Page) => page.locator('[data-shell]').getAttribute('data-active-tab');

test('Space lays an egg in Phase 1 (the primary action) and does not pause', async ({ page }) => {
  await boot(page);
  await expect(page.locator('[data-action="lay-egg"]').first()).toBeVisible();
  const before = await eggsLaid(page);
  await page.keyboard.press('Space');
  await expect.poll(() => eggsLaid(page)).toBeGreaterThan(before);
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);
});

test('1–5 switch tabs in bar order, P pauses and Esc closes a sheet', async ({ page }) => {
  await boot(page, { gameState: COLONY });
  const order = await page.locator('[data-tab-bar] [data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')));
  expect(order.length).toBeGreaterThan(1);
  for (let i = order.length - 1; i >= 0; i--) {
    await page.keyboard.press(String(i + 1));
    await expect.poll(() => activeTab(page)).toBe(order[i]);
  }

  await page.keyboard.press('p');
  await expect(page.locator('body')).toHaveClass(/game-paused/);
  await page.keyboard.press('p');
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);

  await page.locator('[data-resource-strip]').click();
  await expect(page.locator('[data-resource-sheet]')).toBeVisible();
  // Behind an open sheet the colony's keys wait.
  await page.keyboard.press('2');
  expect(await activeTab(page)).toBe(order[0]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-resource-sheet]')).toHaveCount(0);
});

test('switched off in settings, the shortcuts do nothing', async ({ page }) => {
  await boot(page, { gameState: COLONY, settings: { keyboardShortcuts: false } });
  await page.keyboard.press('2');
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  expect(await activeTab(page)).toBe('nest');
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);
});

test('remapped keys follow the new binding; the old ones do nothing', async ({ page }) => {
  const keyBindings: Bindings = { primary: 'Enter', pause: 'k', tab1: '1', tab2: 'w', tab3: '3', tab4: '4', tab5: '5', close: 'q' };
  await boot(page, { settings: { keyBindings } });
  const before = await eggsLaid(page);
  await page.keyboard.press('Space');
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  expect(await eggsLaid(page)).toBe(before);
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);

  await page.keyboard.press('Enter');
  await expect.poll(() => eggsLaid(page)).toBeGreaterThan(before);
  await page.keyboard.press('k');
  await expect(page.locator('body')).toHaveClass(/game-paused/);
});

test('a tip shows on tap as on hover, and Esc dismisses it', async ({ page }) => {
  await boot(page, { gameState: COLONY });
  await page.keyboard.press('2');
  const tip = page.locator('[data-tab-panel="wrkr"] [data-tooltip]').first();
  await expect(tip).toBeVisible();
  await tip.locator('.wrkr-role__label').click();
  await expect(tip).toHaveAttribute('data-tip-open', '');
  await page.keyboard.press('Escape');
  await expect(tip).not.toHaveAttribute('data-tip-open', '');
  await expect(tip).toHaveAttribute('data-tip-dismissed', '');
});
