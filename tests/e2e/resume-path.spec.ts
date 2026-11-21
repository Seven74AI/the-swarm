import { test, expect, type Page } from '@playwright/test';

/**
 * Story 2.3 (D1, ADR 0002): hiding the page saves with `lastSeenAt` and stops the
 * simulation; every return goes through the one resume path. Under 60 s away:
 * no summary. 60 s or more: the offline summary.
 *
 * Hidden/visible is driven by overriding `document.visibilityState` and firing the
 * real events. The wall clock is moved by shifting `Date.now` in the page.
 */

const playTime = (page: Page) =>
  page.evaluate(() => (window as any).__swarm.manager.getState().stats.playTimeMs as number);

async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/** Move the page's wall clock forward by `ms`. */
async function shiftClock(page: Page, ms: number): Promise<void> {
  await page.evaluate((by) => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + by;
  }, ms);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => playTime(page), { timeout: 10_000 }).toBeGreaterThan(0);
});

test('hiding saves with lastSeenAt and stops the simulation', async ({ page }) => {
  const before = await page.evaluate(() => Date.now());
  await setVisibility(page, 'hidden');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('the_swarm_save')!));
  expect(saved.lastSeenAt).toBeGreaterThanOrEqual(before);
  const hiddenPlay = await playTime(page);
  await page.waitForTimeout(500);
  expect(await playTime(page)).toBe(hiddenPlay);
});

test('a short return resumes with no summary and the game runs again', async ({ page }) => {
  await setVisibility(page, 'hidden');
  const hiddenPlay = await playTime(page);
  await shiftClock(page, 20_000);
  await setVisibility(page, 'visible');
  // The 20 s away pass as game time at once, at full efficiency.
  expect(await playTime(page)).toBeGreaterThanOrEqual(hiddenPlay + 19_000);
  await expect(page.locator('.offline-summary-popup')).toHaveCount(0);
  const resumedPlay = await playTime(page);
  await expect.poll(() => playTime(page)).toBeGreaterThan(resumedPlay);
});

test('a return after 60 s or more opens the offline summary', async ({ page }) => {
  await setVisibility(page, 'hidden');
  await shiftClock(page, 5 * 60_000);
  await setVisibility(page, 'visible');
  await expect(page.locator('.offline-summary-popup')).toBeVisible({ timeout: 5_000 });
});

test('every return signal after one hide applies the gap once', async ({ page }) => {
  await setVisibility(page, 'hidden');
  await shiftClock(page, 20_000);
  const before = await playTime(page);
  await setVisibility(page, 'visible');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('focus'));
  });
  // One 20 s gap, not three: well under two gaps' worth of game time right after.
  expect(await playTime(page)).toBeLessThan(before + 30_000);
});
