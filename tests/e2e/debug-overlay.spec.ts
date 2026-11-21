import { test, expect, type Page } from '@playwright/test';

/**
 * Story 1.34 (AR24): in a dev build (the E2E server) the backtick key or a
 * 3-finger long-press opens the debug overlay, and `window.__swarm.cheats`
 * adds resources, sets the phase, skips time and sets the seed. Production
 * (no cheats, overlay only with ?debug=1) is covered by
 * tests/unit/debug/productionBuild.test.ts and enabled.test.ts.
 */

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('the_swarm_onboarding', 'done'));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  await expect(page.locator('[data-debug-root][data-ready]')).toBeAttached();
}

const state = (page: Page) => page.evaluate(() => (window as any).__swarm.manager.getState());
const stat = (page: Page, id: string) => page.locator(`[data-debug-overlay] [data-debug-stat="${id}"] [data-value]`);

test('the backtick key opens the overlay with timings, seed, save version, state and log', async ({ page }) => {
  await boot(page);
  const overlay = page.locator('[data-debug-overlay]');
  await expect(overlay).toHaveCount(0);
  await page.keyboard.press('Backquote');
  await expect(overlay).toBeVisible();

  await expect(stat(page, 'fps')).toHaveText(/^\d+$/);
  await expect(stat(page, 'tick-p50')).toHaveText(/\d/);
  await expect(stat(page, 'tick-p95')).toHaveText(/\d/);
  await expect(stat(page, 'catch-up')).toBeVisible();
  const seed = (await state(page)).seed as number;
  await expect(stat(page, 'seed')).toHaveText(String(seed));
  await expect(stat(page, 'save-version')).toHaveText(/^\d+$/);

  // The inspector: read-only JSON per top-level key.
  const resources = overlay.locator('[data-debug-inspector] [data-key="resources"]');
  await resources.locator('summary').click();
  await expect(resources.locator('pre')).toContainText('"food"');
  await expect(overlay.locator('input, textarea, select')).toHaveCount(0);

  // The log viewer shows the ring buffer.
  expect(await overlay.locator('[data-debug-log] [data-log-entry]').count()).toBeGreaterThan(0);

  // Closing: the CLOSE button, and the key again.
  await overlay.locator('[data-action="close-debug"]').click();
  await expect(overlay).toHaveCount(0);
  await page.keyboard.press('Backquote');
  await expect(overlay).toBeVisible();
  await page.keyboard.press('Backquote');
  await expect(overlay).toHaveCount(0);
});

test('a 3-finger long-press opens the overlay', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const target = document.body;
    const touches = [0, 1, 2].map((i) => new Touch({ identifier: i, target, clientX: 50 + i * 40, clientY: 200 }));
    target.dispatchEvent(new TouchEvent('touchstart', { touches, changedTouches: touches, bubbles: true }));
  });
  await expect(page.locator('[data-debug-overlay]')).toBeVisible();
});

test('export diagnostics from the overlay downloads logs, state, seed and build', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Backquote');
  const download = page.waitForEvent('download');
  await page.locator('[data-debug-overlay] [data-action="export-diagnostics"]').click();
  const file = await download;
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(Array.isArray(data.log)).toBe(true);
  expect(data.save).toHaveProperty('gameState');
  expect(data.seed).toBe(data.save.gameState.seed);
  expect(typeof data.build).toBe('string');
});

test('a new game has a seed, and the save keeps it across a reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.removeItem('the_swarm_save');
    localStorage.setItem('the_swarm_onboarding', 'done');
  });
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  const seed = (await state(page)).seed as number;
  expect(Number.isInteger(seed)).toBe(true);
  await page.reload();
  await expect(page.locator('[data-shell]')).toBeVisible();
  expect((await state(page)).seed).toBe(seed);
});

test.describe('dev cheats on window.__swarm.cheats', () => {
  const cheat = (page: Page, name: string, ...args: unknown[]) =>
    page.evaluate(([n, a]) => (window as any).__swarm.cheats[n as string](...(a as unknown[])), [name, args] as const);

  test.beforeEach(async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => (window as any).__swarm?.cheats);
  });

  test('add resources', async ({ page }) => {
    const before = (await state(page)).resources.food as number;
    expect(await cheat(page, 'addResources', { food: 250 })).toEqual({ ok: true });
    expect((await state(page)).resources.food).toBeGreaterThan(before);
  });

  test('set the seed', async ({ page }) => {
    expect(await cheat(page, 'setSeed', 7)).toEqual({ ok: true });
    expect((await state(page)).seed).toBe(7);
    await page.keyboard.press('Backquote');
    await expect(stat(page, 'seed')).toHaveText('7');
  });

  test('time-skip N hours', async ({ page }) => {
    const before = (await state(page)).stats.playTimeMs as number;
    expect(await cheat(page, 'timeSkip', 0.01)).toEqual({ ok: true });
    expect((await state(page)).stats.playTimeMs).toBeGreaterThan(before + 30_000);
  });

  test('set the phase: the new phase commits and its tabs appear', async ({ page }) => {
    expect(await cheat(page, 'setPhase', 'colony')).toEqual({ ok: true });
    expect((await state(page)).phase).toBe('colony');
    await expect(page.locator('[data-tab="wrkr"]')).toBeVisible({ timeout: 10_000 });
    expect((await cheat(page, 'setPhase', 'egg_laying')).ok).toBe(false);
  });
});
