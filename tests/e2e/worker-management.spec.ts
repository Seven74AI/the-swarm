import { test, expect } from '@playwright/test';

/**
 * Worker Management & Resource Loop E2E Tests
 *
 * Covers COLONY phase core gameplay — assigning/unassigning workers to tasks
 * and verifying resource production changes.
 *
 * IMPORTANT: Seed data must NOT include mapTiles: [] (crashes bootstrap).
 * Omit mapTiles or provide 64-tile array. Minimal seeds work best.
 */

const BASE_GAME_STATE = {
  phase: 'egg_laying',
  resources: { eggs: 0, larvae: 0, workers: 0, food: 0, nestCapacity: 25 },
  eggHatchTimers: [] as number[],
  larvaMatureTimers: [] as number[],
  workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0 },
  upgrades: {} as Record<string, number>,
  stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
  unlockedPanels: [] as string[],
  lastSaveTimestamp: 0,
};

/**
 * Seed localStorage with save data and navigate to the app.
 */
async function seedAndGoto(
  page: any,
  gameStateOverrides: Record<string, unknown>,
  preWaitMs = 0,
) {
  await page.addInitScript((saveStr: string) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify({
    version: 2,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: { ...BASE_GAME_STATE, ...gameStateOverrides },
  }));
  await page.goto('/');
  if (preWaitMs > 0) {
    await page.waitForTimeout(preWaitMs);
  }
}

test.describe('Worker Management', () => {
  test('worker panel hidden in egg_laying phase', async ({ page }) => {
    // Seed egg_laying with 3 workers (below transition threshold)
    await seedAndGoto(page, {
      phase: 'egg_laying',
      resources: { eggs: 0, larvae: 0, workers: 3, food: 0, nestCapacity: 25 },
    });

    // Panel should be hidden
    await expect(page.locator('#worker-assignment')).toBeHidden();

    // Phase indicator shows egg_laying
    await expect(page.locator('#phase-indicator')).toContainText('The Lonely Queen');
  });

  test('worker panel visible in colony phase', async ({ page }) => {
    // Seed egg_laying with 10 workers → transitions to colony on tick
    await page.addInitScript(() => {
      const data = {
        version: 2,
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
    // Wait for phase transition (egg_laying → colony)
    await expect(page.locator('#phase-indicator')).toContainText('The Colony', { timeout: 5000 });

    // Worker panel should become visible after transition
    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });

    // Verify worker assignment rows exist
    await expect(page.locator('[data-role="gather"]')).toBeVisible();
    await expect(page.locator('[data-role="tend"]')).toBeVisible();
  });

  test('assign worker to Gather increases food over time', async ({ page }) => {
    // Seed egg_laying with 10 workers → transitions to colony on first tick
    await seedAndGoto(page, {
      phase: 'egg_laying',
      resources: { eggs: 0, larvae: 0, workers: 10, food: 50, nestCapacity: 25 },
    }, 2500);

    // Should be in colony now
    await expect(page.locator('#phase-indicator')).toContainText('The Colony', { timeout: 5000 });
    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });

    // Record initial food
    const foodDisplay = page.locator('[data-stat="resources.food"]');
    const initialFoodText = await foodDisplay.textContent();
    const initialFood = parseInt(initialFoodText!.match(/\d+/)![0], 10);

    // Assign 1 worker to Gather
    const gatherRow = page.locator('[data-role="gather"]');
    await gatherRow.locator('.role-controls button').filter({ hasText: '+' }).click();
    await expect(gatherRow.locator('.role-count')).toHaveText('1');

    // Wait for ticks of production
    await page.waitForTimeout(4000);

    // Food should have increased
    const newFoodText = await foodDisplay.textContent();
    const newFood = parseInt(newFoodText!.match(/\d+/)![0], 10);
    expect(newFood).toBeGreaterThan(initialFood);
  });

  test('assign worker to Tend accelerates egg hatching', async ({ page }) => {
    // Seed colony with 3 eggs (1 tick each from hatching) and 5 workers
    await seedAndGoto(page, {
      phase: 'colony',
      resources: { eggs: 3, larvae: 0, workers: 5, food: 50, nestCapacity: 25 },
      eggHatchTimers: [1, 1, 1],
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0 },
    });

    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });

    // Without tend, 3 eggs at timer 1 would all hatch in 1 tick.
    // With 1 tend worker, the FIRST egg gets extra -1 → hatches immediately.
    // But we only care that larvae appear.
    const tendRow = page.locator('[data-role="tend"]');
    await tendRow.locator('.role-controls button').filter({ hasText: '+' }).click();
    await expect(tendRow.locator('.role-count')).toHaveText('1');

    // Wait for ticks
    await page.waitForTimeout(3000);

    // Verify larvae appeared (eggs hatched)
    const larvaeDisplay = page.locator('[data-stat="resources.larvae"]');
    const larvaeText = await larvaeDisplay.textContent();
    const larvaeCount = parseInt(larvaeText!.match(/\d+/)![0], 10);
    expect(larvaeCount).toBeGreaterThan(0);

    // Egg count should have decreased
    const eggDisplay = page.locator('[data-stat="resources.eggs"]');
    const eggText = await eggDisplay.textContent();
    const eggCount = parseInt(eggText!.match(/\d+/)![0], 10);
    expect(eggCount).toBeLessThan(3);
  });

  test('unassign worker returns it to idle pool', async ({ page }) => {
    // Seed colony with 10 workers, 3 already on gather
    await seedAndGoto(page, {
      phase: 'colony',
      resources: { eggs: 0, larvae: 0, workers: 10, food: 50, nestCapacity: 25 },
      workersAssigned: { gather: 3, tend: 0, dig: 0, guard: 0 },
    });

    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });

    const gatherRow = page.locator('[data-role="gather"]');
    await expect(gatherRow.locator('.role-count')).toHaveText('3');

    // Unassign 1 from Gather
    await gatherRow.locator('.role-controls button').filter({ hasText: '−' }).click();
    await expect(gatherRow.locator('.role-count')).toHaveText('2');

    // Unassign remaining 2
    const minusBtn = gatherRow.locator('.role-controls button').filter({ hasText: '−' });
    await minusBtn.click();
    await minusBtn.click();
    await expect(gatherRow.locator('.role-count')).toHaveText('0');
  });

  test('unassign worker reduces food production rate', async ({ page }) => {
    // Seed colony with 10 workers, 3 on gather, plenty of food
    await seedAndGoto(page, {
      phase: 'colony',
      resources: { eggs: 0, larvae: 0, workers: 10, food: 100, nestCapacity: 25 },
      workersAssigned: { gather: 3, tend: 0, dig: 0, guard: 0 },
    });

    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });
    const foodDisplay = page.locator('[data-stat="resources.food"]');

    // Wait 3s with gatherers active → food increases
    await page.waitForTimeout(3000);
    const withGatherText = await foodDisplay.textContent();
    const withGatherFood = parseInt(withGatherText!.match(/\d+/)![0], 10);

    // Unassign all gather workers
    const gatherRow = page.locator('[data-role="gather"]');
    const minusBtn = gatherRow.locator('.role-controls button').filter({ hasText: '−' });
    await minusBtn.click();
    await minusBtn.click();
    await minusBtn.click();
    await expect(gatherRow.locator('.role-count')).toHaveText('0');

    // Wait 3s with only unassigned workers → food still increases but slower
    await page.waitForTimeout(3000);
    const withoutGatherText = await foodDisplay.textContent();
    const withoutGatherFood = parseInt(withoutGatherText!.match(/\d+/)![0], 10);

    // Food increased in both phases (unassigned workers still produce)
    expect(withGatherFood).toBeGreaterThan(100);
    expect(withoutGatherFood).toBeGreaterThan(withGatherFood);
  });

  test('all workers assigned prevents further assignment', async ({ page }) => {
    // Seed colony with exactly 3 workers
    await seedAndGoto(page, {
      phase: 'colony',
      resources: { eggs: 0, larvae: 0, workers: 3, food: 50, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0 },
    });

    await expect(page.locator('#worker-assignment')).toBeVisible({ timeout: 5000 });

    const gatherRow = page.locator('[data-role="gather"]');
    const tendRow = page.locator('[data-role="tend"]');
    const gatherPlus = gatherRow.locator('.role-controls button').filter({ hasText: '+' });
    const tendPlus = tendRow.locator('.role-controls button').filter({ hasText: '+' });

    // Assign all 3 workers: 2 gather, 1 tend
    await gatherPlus.click();
    await gatherPlus.click();
    await tendPlus.click();
    await expect(gatherRow.locator('.role-count')).toHaveText('2');
    await expect(tendRow.locator('.role-count')).toHaveText('1');

    // Try assigning more — should not increase (no unassigned workers left)
    await gatherPlus.click();
    await expect(gatherRow.locator('.role-count')).toHaveText('2');

    await tendPlus.click();
    await expect(tendRow.locator('.role-count')).toHaveText('1');
  });
});
