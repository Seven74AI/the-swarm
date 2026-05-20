import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Space Phase UI — Neon Theme, Spaceship & Exploration Panels.
 * Seeds a colony in EXPANSION phase on the verge of SPACE (workers≥30, food≥2000),
 * waits for transition, and verifies the neon theme + new space panels.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 4,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'expansion',
      resources: {
        eggs: 5, larvae: 3, workers: 30, food: 2100,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 200, antimatter: 100, darkMatter: 50,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 20, tend: 6, dig: 3, guard: 0 },
      soldiers: { scouts: 10, warriors: 5, totalKilled: 2 },
      buildings: {
        barracks: { level: 2, count: 1 },
        walls: { level: 2 },
        warehouse: { level: 2 },
      },
      territory: { ownedTiles: 10, bonuses: {} },
      expeditions: [],
      upgrades: {},
      stats: { totalEggsLaid: 500, totalClicks: 800, playTimeMs: 0 },
      unlockedPanels: [],
      lastSaveTimestamp: 0,
      combatSoldiers: 5,
      soldierStats: { strength: 2, defense: 2, speed: 5, maxHp: 12 },
      soldierPipeline: { count: 0, progress: 0 },
      equipment: { weapon: 2, armor: 2 },
      lastBattle: null,
      combatResources: { chitin: 5, silk: 3, venom: 1 },
      battlesWon: 3,
      battlesLost: 1,
      spaceship: { level: 0, fuel: 0, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      ...overrides,
    },
  };
}

/** Read a nested value from the game state. */
async function readGameState(page: Page, path: string): Promise<unknown> {
  return page.evaluate((p) => {
    const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
    const state = (swarm.manager as { getState: () => Record<string, unknown> }).getState();
    const keys = p.split('.');
    let val: unknown = state;
    for (const k of keys) val = (val as Record<string, unknown>)[k];
    return val;
  }, path);
}

/** Seed expansion phase and wait for SPACE transition using fake timers. */
async function seedAndWaitForSpace(page: Page, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.clock.install();
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });

  // Advance time: workers=30, gather=20 → produce food each tick.
  // Need to pass through EXPANSION first, then hit SPACE guard.
  // With food=2100 and workers=30, the guard should trigger quickly.
  await page.clock.runFor(5000);

  // Wait for spaceship panel (only visible in SPACE phase)
  await page.waitForSelector('#spaceship-panel', { timeout: 10000 });
  await expect(page.locator('#phase-indicator')).toContainText('Space', { timeout: 5000 });
}

test.describe('Space Phase — Neon Theme & Panels', () => {
  // ─── Panel Visibility ───────────────────────────────────────────

  test('all expansion panels + space panels are visible in SPACE phase', async ({ page }) => {
    await seedAndWaitForSpace(page);

    // Core panels always visible
    await expect(page.locator('#click-egg')).toBeVisible();
    await expect(page.locator('#activity-log')).toBeVisible();
    await expect(page.locator('#phase-indicator')).toBeVisible();
    await expect(page.locator('.resource-panel')).toBeVisible();

    // Expansion panels still visible
    await expect(page.locator('#worker-assignment')).toBeVisible();
    await expect(page.locator('#soldier-panel')).toBeVisible();
    await expect(page.locator('#battle-panel')).toBeVisible();
    await expect(page.locator('#building-panel')).toBeVisible();
    await expect(page.locator('#expedition-panel')).toBeVisible();
    await expect(page.locator('.map-panel')).toBeVisible();

    // New SPACE panels
    await expect(page.locator('#spaceship-panel')).toBeVisible();
    await expect(page.locator('#exploration-panel')).toBeVisible();
  });

  test('space phase indicator shows "Space"', async ({ page }) => {
    await seedAndWaitForSpace(page);

    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('Space');
  });

  test('neon theme is active — body has phase-space class', async ({ page }) => {
    await seedAndWaitForSpace(page);

    const hasClass = await page.evaluate(() =>
      document.body.classList.contains('phase-space'),
    );
    expect(hasClass).toBe(true);
  });

  // ─── Spaceship Panel ────────────────────────────────────────────

  test('spaceship panel shows Build button when ship level is 0', async ({ page }) => {
    await seedAndWaitForSpace(page);

    const spaceshipPanel = page.locator('#spaceship-panel');
    await expect(spaceshipPanel).toBeVisible();

    // Should show a build button since we have voidCrystals/antimatter/darkMatter
    const buildBtn = spaceshipPanel.locator('button').filter({ hasText: 'Build' });
    await expect(buildBtn).toBeVisible();
    await expect(buildBtn).toBeEnabled();
  });

  test('build spaceship consumes resources and shows Lv.1', async ({ page }) => {
    await seedAndWaitForSpace(page);

    // Verify initial state
    const vcBefore = await readGameState(page, 'resources.voidCrystals') as number;
    expect(vcBefore).toBeGreaterThan(0);

    // Click via evaluate to avoid Playwright stability checks during reactive re-render
    await page.evaluate(() => {
      const btn = document.querySelector('#spaceship-panel button');
      (btn as HTMLButtonElement)?.click();
    });

    // Wait for UI update
    await page.clock.runFor(500);

    // Should now show Lv.1 and fuel display
    await expect(page.locator('#spaceship-panel')).toContainText('Lv.1', { timeout: 3000 });
    await expect(page.locator('#spaceship-panel')).toContainText('Fuel');

    // Resources deducted
    const vcAfter = await readGameState(page, 'resources.voidCrystals') as number;
    expect(vcAfter).toBeLessThan(vcBefore);
  });

  test('spaceship upgrade button available when resources sufficient', async ({ page }) => {
    await seedAndWaitForSpace(page, {
      spaceship: { level: 1, fuel: 80, maxFuel: 100 },
      resources: {
        eggs: 5, larvae: 3, workers: 30, food: 2100,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 200, antimatter: 100, darkMatter: 50,
      },
    });

    const spaceshipPanel = page.locator('#spaceship-panel');
    await expect(spaceshipPanel).toContainText('Lv.1');
    await expect(spaceshipPanel).toContainText('Fuel');

    // Should show Upgrade button
    const upgradeBtn = spaceshipPanel.locator('button').filter({ hasText: 'Upgrade' });
    await expect(upgradeBtn).toBeVisible();
    await expect(upgradeBtn).toBeEnabled();

    // Click via evaluate to avoid Playwright stability checks during reactive re-render
    await page.evaluate(() => {
      const btn = document.querySelector('#spaceship-panel button');
      (btn as HTMLButtonElement)?.click();
    });
    await page.clock.runFor(500);

    await expect(spaceshipPanel).toContainText('Lv.2', { timeout: 3000 });
  });

  test('spaceship build button disabled without resources', async ({ page }) => {
    await seedAndWaitForSpace(page, {
      resources: {
        eggs: 5, larvae: 3, workers: 30, food: 2100,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
    });

    const buildBtn = page.locator('#spaceship-panel button').filter({ hasText: 'Build' });
    await expect(buildBtn).toBeDisabled();
  });

  // ─── Exploration Panel ──────────────────────────────────────────

  test('exploration panel shows destinations and launch button', async ({ page }) => {
    // Seed with spaceship built so exploration works
    await seedAndWaitForSpace(page, {
      spaceship: { level: 1, fuel: 100, maxFuel: 100 },
    });

    const explorationPanel = page.locator('#exploration-panel');
    await expect(explorationPanel).toBeVisible();

    // Should show title
    await expect(explorationPanel).toContainText('Exploration');

    // Should show destination select with options
    const select = explorationPanel.locator('select');
    await expect(select).toBeVisible();
    const options = select.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Launch button should be enabled (ships > 1, scouts > 0)
    const launchBtn = explorationPanel.locator('button').filter({ hasText: 'Launch' });
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toBeEnabled();
  });

  test('exploration launch button disabled without spaceship', async ({ page }) => {
    await seedAndWaitForSpace(page);

    const launchBtn = page.locator('#exploration-panel button').filter({ hasText: 'Launch' });
    await expect(launchBtn).toBeDisabled();
  });

  test('launch probe — scouts deducted, probe row appears', async ({ page }) => {
    await seedAndWaitForSpace(page, {
      spaceship: { level: 1, fuel: 100, maxFuel: 100 },
      soldiers: { scouts: 10, warriors: 5, totalKilled: 0 },
    });

    const scoutsBefore = await readGameState(page, 'soldiers.scouts') as number;

    // Set scouts input to 2 and launch
    const scoutInput = page.locator('#exploration-panel .exploration-input');
    await scoutInput.fill('2');

    // Click via evaluate to avoid Playwright stability checks during reactive re-render
    await page.evaluate(() => {
      const btn = document.querySelector('#exploration-panel button');
      (btn as HTMLButtonElement)?.click();
    });
    await page.clock.runFor(500);

    // Scouts deducted
    const scoutsAfter = await readGameState(page, 'soldiers.scouts') as number;
    expect(scoutsAfter).toBe(scoutsBefore - 2);

    // Probe row should appear
    const probeRows = page.locator('#exploration-panel .exploration-row');
    await expect(probeRows).toHaveCount(1, { timeout: 3000 });
    await expect(probeRows.first()).toContainText('⏳');
  });

  // ─── Theme Persistence ──────────────────────────────────────────

  test('space theme persists after save and reload', async ({ page }) => {
    await seedAndWaitForSpace(page);

    // Verify theme is active
    let hasClass = await page.evaluate(() =>
      document.body.classList.contains('phase-space'),
    );
    expect(hasClass).toBe(true);

    // Trigger manual save
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
      const state = (swarm.manager as { getState: () => unknown }).getState();
      sm.save(state, Date.now());
    });

    // Reload
    await page.reload();
    await page.waitForSelector('#panels', { timeout: 10000 });
    await page.clock.runFor(5000);

    // Wait for SPACE phase to be re-entered (state is preserved in save)
    await expect(page.locator('#phase-indicator')).toContainText('Space', { timeout: 10000 });

    // Theme should be re-applied
    hasClass = await page.evaluate(() =>
      document.body.classList.contains('phase-space'),
    );
    expect(hasClass).toBe(true);

    // Both space panels should be visible after reload
    await expect(page.locator('#spaceship-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#exploration-panel')).toBeVisible({ timeout: 5000 });
  });
});
