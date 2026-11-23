import { test, expect, type Page } from '@playwright/test';

/** Story 9.12 (FR66, UX-DR51, FR12): where the food goes, and the fix one tap away. */
const COMBAT = {
  phase: 'combat',
  resources: { eggs: 0, larvae: 0, workers: 30, food: 5_000, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
  workersAssigned: { gather: 10, forage: 0, tend: 5, dig: 0, guard: 1, researchers: 0 },
  combatSoldiers: 4,
};

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save) => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    localStorage.setItem('the_swarm_save', save);
  }, JSON.stringify({ version: 37, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-resource-strip]').click();
  await expect(page.locator('[data-resource-sheet]')).toBeVisible();
}

test('the food block names who brings food in and who eats it', async ({ page }) => {
  await seed(page, COMBAT);
  const block = page.locator('[data-resource-sheet] [data-food-block]');
  await expect(block.locator('[data-food="in"]')).toContainText(/FOOD IN \+/);
  await expect(block.locator('[data-food="in"]')).toContainText('gatherers 10');
  await expect(block.locator('[data-food="eaten"]')).toContainText(/EATEN −/);
  await expect(block.locator('[data-food="eaten"]')).toContainText('soldiers 4');
  await expect(block.locator('[data-food="feeds"]')).toHaveText(/^ONE GATHERER FEEDS \d+\.$/);
});

test('gatherers opens WRKR on the Gather row; soldiers opens WAR', async ({ page }) => {
  await seed(page, COMBAT);
  await page.locator('[data-food-jump="gather"]').click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-tab', 'wrkr');
  await expect(page.locator('[data-role="gather"]')).toHaveAttribute('data-jumped', '');
  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-food-jump="soldiers"]').click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-tab', 'front');
  await expect(page.locator('#soldier-panel')).toBeVisible();
});
