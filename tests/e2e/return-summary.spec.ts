import { test, expect, type Page } from '@playwright/test';

/**
 * Story 2.9 (FR23, FR27, UX-DR24, UX-DR43): every return starts with a decision.
 * After 60 s or more away the offline summary opens first, focused, with what
 * changed and warn lines, and no suggestion of what to do next; under
 * 60 s no sheet opens and the strip deltas flash once. Invariants only.
 */

const PHONE = { width: 360, height: 640 };
const HOUR = 3_600_000;

/** A colony where every worker tends: nothing gathers, so upkeep runs the stock out while away. */
const HUNGRY_COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 10, food: 50, nestCapacity: 1000 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 0, tend: 10, dig: 0, guard: 0, researchers: 0 },
};

async function seedAway(page: Page, gameState: Record<string, unknown>, awayMs: number): Promise<void> {
  await page.addInitScript(
    ([state, away]: [Record<string, unknown>, number]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const at = Date.now() - away;
      localStorage.setItem('the_swarm_save', JSON.stringify({ version: 18, timestamp: at, lastSeenAt: at, playTimeMs: 0, gameState: state }));
      localStorage.setItem('the_swarm_onboarding', 'done');
    },
    [gameState, awayMs] as [Record<string, unknown>, number],
  );
  await page.goto('/');
}

const summary = (page: Page) => page.locator('.offline-summary-popup');

test.describe('the return summary (Story 2.9)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test('opens first and focused, says how long, what changed and that upkeep outran food', async ({ page }) => {
    await seedAway(page, HUNGRY_COLONY, 2 * HOUR);
    await expect(summary(page)).toBeVisible({ timeout: 10_000 });
    const head = summary(page).locator('[data-sheet-headline]');
    await expect(head).toBeFocused();
    await expect(head).toHaveText(/^YOU WERE GONE \S.*\. THE NEST KEPT WORKING\.$/);
    await expect(summary(page).locator('.offline-efficiency')).toContainText('%');
    // Food ran out: a loss with its ▼, and the warn line with how long.
    await expect(summary(page).locator('[data-offline-change="food"]')).toHaveAttribute('data-trend', 'down');
    await expect(summary(page).locator('[data-offline-warn="starved"]')).toHaveText(/^UPKEEP OUTRAN FOOD FOR \S.*\.$/);
    await expect(summary(page).locator('[data-offline-cap]')).toHaveCount(0);
  });

  test('it suggests nothing to buy: the only button goes back to the nest', async ({ page }) => {
    await seedAway(page, HUNGRY_COLONY, 2 * HOUR);
    await expect(summary(page)).toBeVisible({ timeout: 10_000 });
    await expect(summary(page).locator('button[data-action="offline-next"]')).toHaveCount(0);
    await expect(summary(page).locator('[data-next-action]')).toHaveCount(0);
    await summary(page).locator('[data-sheet-close]').click();
    await expect(summary(page)).toHaveCount(0);
  });

  test('past the cap it says the nest stopped growing, reading the live cap', async ({ page }) => {
    await seedAway(page, HUNGRY_COLONY, 30 * HOUR);
    const cap = summary(page).locator('[data-offline-cap]');
    await expect(cap).toBeVisible({ timeout: 10_000 });
    const capMs = Number(await cap.getAttribute('data-offline-cap'));
    expect(capMs).toBeGreaterThan(0);
    await expect(cap).toHaveText(/^THE NEST STOPPED GROWING AFTER \S.*\.$/);
  });

  test('a short return opens no sheet and flashes the strip deltas once', async ({ page }) => {
    await seedAway(page, { ...HUNGRY_COLONY, workersAssigned: { gather: 10, tend: 0, dig: 0, guard: 0, researchers: 0 } }, 0);
    await expect(page.locator('[data-resource-strip]')).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      const real = Date.now.bind(Date);
      Date.now = () => real() + 20_000;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('[data-resource-strip]')).toHaveAttribute('data-flash', '');
    await expect(page.locator('[data-resource-strip]')).not.toHaveAttribute('data-flash', '');
    await expect(summary(page)).toHaveCount(0);
  });
});
