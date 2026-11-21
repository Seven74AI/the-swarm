import { test, expect, type CDPSession, type Page } from '@playwright/test';
import { settleReveals } from './helpers/reveal';

/**
 * #370: the mobile-first game played by touch. Runs only in the `mobile` project
 * (a phone device with `hasTouch`), see playwright.config.ts. Taps go through
 * `locator.tap()`; holds use real touch points (CDP `Input.dispatchTouchEvent`),
 * so the pointer events the game sees have `pointerType: 'touch'`.
 *
 * Not covered: swipe-scrolling. Headless Chromium doesn't turn synthetic touch
 * gestures into scrolls (not even on a bare overflowing div), so a swipe test
 * could only fail. Scrolling by wheel and programmatic scroll is covered in tab-shell.
 */

type Swarm = { manager: { getState(): { phase: string; stats: { totalClicks: number } } } };
const clicks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.manager.getState().stats.totalClicks);

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'done');
  }, JSON.stringify({ version: 18, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  await settleReveals(page);
}

const EGG_LAYING = { phase: 'egg_laying', resources: { workers: 1, food: 100, nestCapacity: 50 } };
const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 20, food: 500, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
};

async function centre(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = (await page.locator(selector).first().boundingBox())!;
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

const touch = (cdp: CDPSession, type: 'touchStart' | 'touchEnd', p?: { x: number; y: number }) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });

test.describe('Touch (#370)', () => {
  test.beforeEach(({ browserName: _browser }, testInfo) => {
    expect(testInfo.project.use.hasTouch, 'runs on the touch project only').toBe(true);
  });

  test('a tap on > LAY EGG lays one egg', async ({ page }) => {
    await seed(page, EGG_LAYING);
    const before = await clicks(page);
    await page.locator('[data-primary-zone] #click-egg').tap();
    await expect.poll(() => clicks(page)).toBe(before + 1);
    await expect(page.locator('.click-particle').first()).toContainText('+');
  });

  test('holding > LAY EGG with a finger repeats, and lifting it stops', async ({ page }) => {
    await seed(page, EGG_LAYING);
    const cdp = await page.context().newCDPSession(page);
    const at = await centre(page, '[data-primary-zone] #click-egg');
    const before = await clicks(page);
    await touch(cdp, 'touchStart', at);
    await expect.poll(() => clicks(page), { timeout: 5_000 }).toBeGreaterThan(before + 2);
    await touch(cdp, 'touchEnd');
    const lifted = await clicks(page);
    // The repeat has stopped: a later tap adds exactly one.
    await page.locator('[data-primary-zone] #click-egg').tap();
    await expect.poll(() => clicks(page)).toBe(lifted + 1);
  });

  test('tapping the tab bar switches tabs', async ({ page }) => {
    await seed(page, COLONY);
    for (const tab of ['wrkr', 'build', 'log', 'nest']) {
      await page.locator(`[data-tab-bar] [data-tab="${tab}"]`).tap();
      await expect(page.locator(`[data-tab-bar] [data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator(`[data-tab-panel="${tab}"]`)).toBeVisible();
    }
  });

  test('tapping the resource strip opens its sheet; tapping close closes it', async ({ page }) => {
    await seed(page, COLONY);
    await page.locator('[data-resource-strip]').tap();
    const sheet = page.locator('[data-resource-sheet]');
    await expect(sheet).toBeVisible();
    await sheet.locator('[data-sheet-close]').tap();
    await expect(sheet).toHaveCount(0);
  });
});
