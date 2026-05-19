import { test, expect } from '@playwright/test';

test('click egg button increments counter', async ({ page }) => {
  await page.goto('/');
  // Verify initial egg count is 0
  const eggDisplay = page.locator('[data-stat="resources.eggs"]');
  await expect(eggDisplay).toHaveText('🥚 Eggs: 0');

  // Click the egg button
  await page.locator('#click-egg').click();

  // Verify count changed
  await expect(eggDisplay).not.toHaveText('🥚 Eggs: 0');
});

test('phase indicator shows initial phase', async ({ page }) => {
  await page.goto('/');
  const indicator = page.locator('#phase-indicator');
  await expect(indicator).toContainText('The Lonely Queen');
});

test('phase transitions from egg_laying to colony', async ({ page }) => {
  // Set save data before page loads so bootstrap picks it up
  await page.addInitScript(() => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      playTimeMs: 0,
      gameState: {
        phase: 'egg_laying',
        resources: { eggs: 0, larvae: 0, workers: 10, food: 0, nestCapacity: 25 },
        eggHatchTimers: [],
        larvaMatureTimers: [],
        workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0 },
        upgrades: {},
        stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
        unlockedPanels: [],
        lastSaveTimestamp: 0,
      },
    };
    localStorage.setItem('the_swarm_save', JSON.stringify(data));
  });

  await page.goto('/');
  // Wait for a tick to fire (1 second interval)
  await page.waitForTimeout(2000);
  const indicator = page.locator('#phase-indicator');
  await expect(indicator).toContainText('The Colony');
});

test('save persists across reload', async ({ page }) => {
  await page.goto('/');

  // Click the egg button
  await page.locator('#click-egg').click();
  await page.waitForTimeout(500);

  // Manually trigger save
  await page.evaluate(() => {
    const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
    if (swarm && swarm.saveManager) {
      const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
      const state = (swarm.manager as { getState: () => unknown }).getState();
      sm.save(state, 0);
    }
  });

  await page.reload();
  const eggDisplay = page.locator('[data-stat="resources.eggs"]');
  await expect(eggDisplay).not.toHaveText('🥚 Eggs: 0');
});
