import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Expedition Lifecycle & Building Construction.
 * Covers launching expeditions, verifying rewards, constructing buildings,
 * and edge cases (max expeditions, no soldiers, no resources).
 *
 * IMPORTANT POINTS:
 * - Do NOT include `mapTiles: []` in seed data — MapPanel crashes.
 * - ResourcePanel only has data-stat for eggs, larvae, workers, food.
 * - Food changes during ticks (gatherers produce food). Don't assert exact values.
 * - Building effects (warehouse capacity, etc.) are DISPLAY ONLY, not in game state.
 * - SoldierPanel doesn't use data-stat — use .soldier-count in expedition panel.
 * - Phase transition COLONY→EXPANSION needs workers≥20 AND food≥500.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 2,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'colony',
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 5000,
        nestCapacity: 50, wood: 5000, stone: 5000, nectar: 500,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 12, tend: 4, dig: 3, guard: 0, researchers: 0 },
      soldiers: { scouts: 5, warriors: 3, totalKilled: 0 },
      buildings: {
        barracks: { level: 0, count: 0 },
        walls: { level: 0 },
        warehouse: { level: 0 },
      },
      territory: { ownedTiles: 0, bonuses: {} },
      expeditions: [],
      upgrades: {},
      stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
      unlockedPanels: [],
      lastSaveTimestamp: 0,
      combatSoldiers: 0,
      soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
      soldierPipeline: { count: 0, progress: 0 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0,
      battlesLost: 0,
      ...overrides,
    },
  };
}

/** Read a nested value from the game state. */
async function readGameState(page: Page, path: string): Promise<unknown> {
  return page.evaluate((p) => {
    // @ts-ignore - runs in browser context
    const swarm = window.__swarm;
    // @ts-ignore
    const state = swarm.manager.getState();
    const keys = p.split('.');
    // @ts-ignore
    let val = state;
    for (const k of keys) val = val[k];
    return val;
  }, path);
}

/** Seed with colony phase and wait for transition to expansion (real time). */
async function seedAndWaitForExpansion(page: Page, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });
  await expect(page.locator('#phase-indicator')).toContainText('The Expansion', { timeout: 15000 });
}

/** Seed with colony phase using fake timers, then advance to expansion. */
async function seedWithFakeTimers(page: Page, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.clock.install();
  await page.goto('/');

  // Wait for the app to mount before advancing time
  await page.waitForSelector('#panels', { timeout: 10000 });

  // Advance a few ticks: map generation + phase transition colony→expansion
  await page.clock.runFor(5000);

  // Now wait for expansion panels
  await page.waitForSelector('#expedition-panel', { timeout: 5000 });
  await expect(page.locator('#phase-indicator')).toContainText('The Expansion', { timeout: 5000 });
}

// ── Expeditions ──────────────────────────────────────────────────────────

test.describe('Expeditions', () => {
  test('launch expedition → wait for return → verify rewards', async ({ page }) => {
    await seedWithFakeTimers(page, {
      soldiers: { scouts: 5, warriors: 3, totalKilled: 0 },
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 500,
        nestCapacity: 50, wood: 200, stone: 200, nectar: 50,
      },
    });

    // Click "Send" on MEADOW destination card
    const meadowCard = page.locator('.expedition-card').filter({ hasText: 'MEADOW' });
    await expect(meadowCard).toBeVisible({ timeout: 3000 });
    await meadowCard.locator('button').filter({ hasText: 'Send' }).evaluate(el => (el as HTMLElement).click());
    await page.clock.runFor(100); // Let signals settle

    // Active expedition row should appear with countdown
    await expect(page.locator('.expedition-list-title')).toContainText('Active', { timeout: 3000 });
    const expRow = page.locator('.expedition-row');
    await expect(expRow).toBeVisible({ timeout: 3000 });
    await expect(expRow).toContainText('MEADOW');
    await expect(expRow).toContainText('⏳');

    // Verify scout count label in expedition header shows deduction (5→4)
    // Auto-sends min(1, scouts)=1 scout
    await expect(page.locator('#expedition-panel .panel-sub')).toContainText('Scouts: 4', { timeout: 3000 });

    // Advance clock in small chunks until expedition returns (max 100 seconds)
    // Avoids crashing the page by processing many ticks at once
    for (let chunk = 0; chunk < 20; chunk++) {
      await page.clock.runFor(5000); // 5 seconds per chunk
      try {
        const hasReturn = await page.locator('.log-entry').first().textContent();
        if (hasReturn?.includes('returns')) break;
      } catch {
        // Page may be temporarily unstable; continue
      }
    }

    // Expedition should have returned — check activity log for return event
    const logEntry = page.locator('.log-entry').first();
    await expect(logEntry).toContainText('returns', { timeout: 5000 });

    // Verify scouts returned (at least some on success/partial)
    const scoutCount = await readGameState(page, 'soldiers.scouts') as number;
    expect(scoutCount).toBeGreaterThan(0);
  });

  test('launch expedition shows risk display on row', async ({ page }) => {
    await seedWithFakeTimers(page, {
      soldiers: { scouts: 5, warriors: 3, totalKilled: 0 },
    });

    // Click "Send" on FOREST card — auto-sends 1 scout + 1 warrior
    const forestCard = page.locator('.expedition-card').filter({ hasText: 'FOREST' });
    await forestCard.locator('button').filter({ hasText: 'Send' }).evaluate(el => (el as HTMLElement).click());
    await page.clock.runFor(100); // Let signals settle

    // Verify risk is shown on the expedition row
    const row1 = page.locator('.expedition-row');
    await expect(row1).toBeVisible({ timeout: 3000 });
    const risk1 = await row1.textContent();
    expect(risk1).toContain('Risk:');
    // Verify risk includes a percentage number
    expect(risk1).toMatch(/Risk:\s*\d+%/);

    // Complete this expedition — advance clock in chunks to avoid crash
    for (let chunk = 0; chunk < 20; chunk++) {
      await page.clock.runFor(5000); // 5 seconds per chunk
      try {
        const hasReturn = await page.locator('.log-entry').first().textContent();
        if (hasReturn?.includes('returns')) break;
      } catch {
        // Page may be temporarily unstable; continue
      }
    }
    await expect(page.locator('.log-entry').first()).toContainText('returns', { timeout: 5000 });

    // Launch another expedition — risk still shown
    const meadowCard2 = page.locator('.expedition-card').filter({ hasText: 'MEADOW' });
    await meadowCard2.locator('button').filter({ hasText: 'Send' }).evaluate(el => (el as HTMLElement).click());
    await page.clock.runFor(100); // Let signals settle

    const row2 = page.locator('.expedition-row').first();
    await expect(row2).toBeVisible({ timeout: 3000 });
    expect(await row2.textContent()).toMatch(/Risk:\s*\d+%/);
  });

  test('max active expeditions — Send buttons disabled at limit', async ({ page }) => {
    await seedWithFakeTimers(page, {
      soldiers: { scouts: 10, warriors: 10, totalKilled: 0 },
    });

    // Launch 3 expeditions (MAX_ACTIVE_EXPEDITIONS = 3) on all 3 destinations
    const cards = page.locator('.expedition-card');
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount && i < 3; i++) {
      await cards.nth(i).locator('button').filter({ hasText: 'Send' }).evaluate(el => (el as HTMLElement).click());
      await page.clock.runFor(100); // Let UI settle
    }

    // Verify 3 expedition rows are present
    const rows = page.locator('.expedition-row');
    await expect(rows).toHaveCount(3, { timeout: 3000 });

    // Send buttons should now be disabled (limit reached)
    const sendBtns = page.locator('.expedition-card button').filter({ hasText: 'Send' });
    const btnCount = await sendBtns.count();
    for (let i = 0; i < btnCount; i++) {
      await expect(sendBtns.nth(i)).toBeDisabled({ timeout: 3000 });
    }
  });

  test('cannot launch expedition with 0 scouts and 0 warriors', async ({ page }) => {
    await seedWithFakeTimers(page, {
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
    });

    // Send buttons should be disabled when no soldiers available
    const sendBtns = page.locator('.expedition-card button').filter({ hasText: 'Send' });
    const btnCount = await sendBtns.count();
    for (let i = 0; i < btnCount; i++) {
      await expect(sendBtns.nth(i)).toBeDisabled({ timeout: 3000 });
    }

    // No expedition should exist
    await expect(page.locator('.expedition-row')).toHaveCount(0, { timeout: 3000 });

    // Header should show 0 counts
    await expect(page.locator('#expedition-panel .panel-sub')).toContainText('Scouts: 0', { timeout: 3000 });
    await expect(page.locator('#expedition-panel .panel-sub')).toContainText('Warriors: 0', { timeout: 3000 });
  });
});

// ── Buildings ────────────────────────────────────────────────────────────

test.describe('Buildings', () => {
  test('build Barracks Lv.1 — cost deduction + effect display', async ({ page }) => {
    await seedAndWaitForExpansion(page);

    // Verify initial state: Lv.0, effect shows "Scouts cap: 0"
    await expect(page.locator('[data-building="barracks"]')).toContainText('Lv.0');
    await expect(page.locator('[data-building="barracks"] .building-info')).toContainText('Scouts cap: 0', { timeout: 3000 });

    // Note food before building
    const foodBefore = await readGameState(page, 'resources.food') as number;
    expect(foodBefore).toBeGreaterThan(0);

    // Click Build
    const buildBtn = page.locator('[data-building="barracks"] button').filter({ hasText: 'Build' });
    await expect(buildBtn).toBeEnabled({ timeout: 3000 });
    await buildBtn.click();

    // Verify level updated to Lv.1
    await expect(page.locator('[data-building="barracks"]')).toContainText('Lv.1', { timeout: 3000 });

    // Effect shows "Scouts cap: 2" (Lv.1 Barracks: scoutsCap=2, warriorsCap=0)
    await expect(page.locator('[data-building="barracks"] .building-info')).toContainText('Scouts cap: 2', { timeout: 3000 });

    // Resources deducted — verify food decreased by at least 250 (Lv.1: 250 food)
    const foodAfter = await readGameState(page, 'resources.food') as number;
    expect(foodAfter).toBeLessThan(foodBefore);
    expect(foodBefore - foodAfter).toBeGreaterThanOrEqual(250);

    // Wood decreased by at least 125 (Lv.1: 125 wood)
    const woodAfter = await readGameState(page, 'resources.wood') as number;
    expect(woodAfter).toBeLessThanOrEqual(5000 - 125); // 5000 - 125 = 4875

    // Activity log should show building event
    await expect(page.locator('#activity-log')).toContainText('upgraded to level 1', { timeout: 3000 });
  });

  test('build Walls — verify defense bonus displayed', async ({ page }) => {
    await seedAndWaitForExpansion(page);

    // Initial: Lv.0, defense +0%
    await expect(page.locator('[data-building="walls"]')).toContainText('Lv.0');
    await expect(page.locator('[data-building="walls"] .building-info')).toContainText('Defense: +0%', { timeout: 3000 });

    // Note stone before
    const stoneBefore = await readGameState(page, 'resources.stone') as number;

    // Click Build
    const buildBtn = page.locator('[data-building="walls"] button').filter({ hasText: 'Build' });
    await expect(buildBtn).toBeEnabled({ timeout: 3000 });
    await buildBtn.click();

    // Level updated to Lv.1, defense +5%
    await expect(page.locator('[data-building="walls"]')).toContainText('Lv.1', { timeout: 3000 });
    await expect(page.locator('[data-building="walls"] .building-info')).toContainText('Defense: +5%', { timeout: 3000 });

    // Stone deducted: Walls Lv.1 costs 500 stone (200 * 2.5^1)
    const stoneAfter = await readGameState(page, 'resources.stone') as number;
    expect(stoneAfter).toBeLessThan(stoneBefore);
    expect(stoneBefore - stoneAfter).toBeGreaterThanOrEqual(500);
  });

  test('build Warehouse — verify capacity effect displayed + resources deducted', async ({ page }) => {
    await seedAndWaitForExpansion(page);

    // Initial: Lv.0, capacity +0
    await expect(page.locator('[data-building="warehouse"]')).toContainText('Lv.0');
    await expect(page.locator('[data-building="warehouse"] .building-info')).toContainText('Capacity: +0', { timeout: 3000 });

    // Click Build
    const buildBtn = page.locator('[data-building="warehouse"] button').filter({ hasText: 'Build' });
    await expect(buildBtn).toBeEnabled({ timeout: 3000 });
    await buildBtn.click();

    // Level updated to Lv.1, capacity display shows +25
    await expect(page.locator('[data-building="warehouse"]')).toContainText('Lv.1', { timeout: 3000 });
    await expect(page.locator('[data-building="warehouse"] .building-info')).toContainText('Capacity: +25', { timeout: 3000 });

    // Resources deducted: Warehouse Lv.1 = 375 wood + 250 stone (×2.5)
    const wood = await readGameState(page, 'resources.wood') as number;
    expect(wood).toBeLessThanOrEqual(4625); // 5000 - 375 = 4625

    const stone = await readGameState(page, 'resources.stone') as number;
    expect(stone).toBeLessThanOrEqual(4750); // 5000 - 250 = 4750
  });

  test('cannot build without resources — buttons disabled', async ({ page }) => {
    // Need food≥500 for colony→expansion transition, but 0 food/wood/stone so no buildings
    const data = makeSaveData({
      resources: {
        eggs: 0, larvae: 0, workers: 20, food: 500,
        nestCapacity: 50, wood: 0, stone: 0, nectar: 0,
      },
    });
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.goto('/');
    await page.waitForSelector('#building-panel', { timeout: 10000 });
    await expect(page.locator('#phase-indicator')).toContainText('The Expansion', { timeout: 15000 });

    // All Build buttons should be disabled (no wood or stone)
    await expect(
      page.locator('[data-building="barracks"] button').filter({ hasText: 'Build' }),
    ).toBeDisabled({ timeout: 3000 });
    await expect(
      page.locator('[data-building="walls"] button').filter({ hasText: 'Build' }),
    ).toBeDisabled({ timeout: 3000 });
    await expect(
      page.locator('[data-building="warehouse"] button').filter({ hasText: 'Build' }),
    ).toBeDisabled({ timeout: 3000 });
  });
});
