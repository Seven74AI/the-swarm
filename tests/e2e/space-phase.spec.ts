import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';
import { tapContinue } from './helpers/phase';

/**
 * E2E: Space Phase UI — Neon Theme, Spaceship & Exploration Panels.
 * Seeds a colony in EXPANSION phase on the verge of SPACE (workers≥80, food≥5000),
 * waits for transition, and verifies the neon theme + new space panels.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'expansion',
      resources: {
        eggs: 5, larvae: 3, workers: 80, food: 5000,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 500, antimatter: 99, darkMatter: 49,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 40, tend: 6, dig: 3, guard: 0, researchers: 0 },
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
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
      autoProduction: {
        enabled: false,
        researches: {},
        buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 },
        progress: 0,
      },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'available' as const, progress: 0 },
          antimatterContainment: { state: 'locked' as const, progress: 0 },
          darkMatterDetection: { state: 'locked' as const, progress: 0 },
        },
      },
      conversions: { particleLab: 0 },
      offlineEfficiency: 0.5,
      entropy: 0,
      entropyDampener: { level: 0 },
      prestigeTree: { purchased: [] },
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

/**
 * Wait for the SPACE phase to be entered and its panels revealed.
 *
 * Do NOT fast-forward a fixed span with `page.clock.runFor()` here. The seed
 * already satisfies the EXPANSION→SPACE guard, so the transition fires on the
 * first tick. After `clock.install()` the fake clock keeps flowing in real
 * time, so web-first assertions are enough. `runFor(n)` fires every fake timer
 * in the span one at a time, and Playwright yields a real macrotask (clamped to
 * ≥4ms by Chromium) after each one. The game schedules ~120 timers per fake
 * second (Ticker rAF, panel render rAFs, HUD flash timeouts), so each
 * `runFor(5000)` cost seconds of wall time. Under CI CPU contention that pushed
 * these tests past the 30s test timeout.
 */
async function waitForSpacePanels(page: Page) {
  // The seed meets EXPANSION → SPACE's goal; SPACE is entered on CONTINUE (Story 1.19).
  await tapContinue(page);
  await expect(page.locator('#phase-indicator')).toContainText('Space', { timeout: 10000 });
  // Space panels live in FRONT → STARS (Story 1.15).
  await openTab(page, 'front', 'stars');
  await expect(page.locator('#spaceship-panel')).toBeVisible({ timeout: 10000 });
}

/** Seed expansion phase (on the verge of SPACE) and wait for the SPACE transition. */
async function seedAndWaitForSpace(page: Page, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.clock.install();
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });
  await waitForSpacePanels(page);
}

test.describe('Space Phase — Neon Theme & Panels', () => {
  // ─── Panel Visibility ───────────────────────────────────────────

  test('all expansion panels + space panels are visible in SPACE phase', async ({ page }) => {
    await seedAndWaitForSpace(page);

    // New SPACE panels (FRONT → STARS, opened by the helper)
    await expect(page.locator('#spaceship-panel')).toBeVisible();
    await expect(page.locator('#exploration-panel')).toBeVisible();

    // Core panels: NEST and the strip
    await openTab(page, 'nest');
    await expect(page.locator('#click-egg')).toBeVisible();
    await expect(page.locator('#activity-log')).toBeVisible();
    await expect(page.locator('#phase-indicator')).toBeVisible();
    await expect(page.locator('.resource-panel')).toBeVisible();

    // Expansion panels still there, each in its tab
    await openTab(page, 'wrkr');
    await expect(page.locator('#worker-assignment')).toBeVisible();
    await openTab(page, 'front', 'war');
    await expect(page.locator('#soldier-panel')).toBeVisible();
    await expect(page.locator('#battle-panel')).toBeVisible();
    await openTab(page, 'build');
    await expect(page.locator('#building-panel')).toBeVisible();
    await openTab(page, 'front', 'map');
    await expect(page.locator('#expedition-panel')).toBeVisible();
    await expect(page.locator('.map-panel')).toBeVisible();
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
    // Verify initial food (Lv.0 spaceship costs food, wood, stone, nectar — NOT voidCrystals)
    const foodBefore = await readGameState(page, 'resources.food') as number;
    expect(foodBefore).toBeGreaterThan(0);

    // Click Build button via dispatchEvent to avoid DOM detachment
    const buildBtn = page.locator('#spaceship-panel button').filter({ hasText: 'Build' }).first();
    await expect(buildBtn).toBeEnabled({ timeout: 3000 });
    await buildBtn.dispatchEvent('click');

    // Wait for UI update
    await page.clock.runFor(500);

    // Should now show Lv.1 and fuel display
    await expect(page.locator('#spaceship-panel')).toContainText('Lv.1', { timeout: 3000 });
    await expect(page.locator('#spaceship-panel')).toContainText('Fuel');

    // Resources deducted (Lv.0 build costs 2000 food)
    const foodAfter = await readGameState(page, 'resources.food') as number;
    expect(foodAfter).toBeLessThan(foodBefore);
  });

  test('spaceship upgrade button available when resources sufficient', async ({ page }) => {
    await seedAndWaitForSpace(page, {
      spaceship: { level: 1, fuel: 80, maxFuel: 100 },
      resources: {
        eggs: 5, larvae: 3, workers: 80, food: 5000,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 200, antimatter: 50, darkMatter: 10,
      },
    });

    const spaceshipPanel = page.locator('#spaceship-panel');
    await expect(spaceshipPanel).toContainText('Lv.1');
    await expect(spaceshipPanel).toContainText('Fuel');

    // Should show Upgrade button
    const upgradeBtn = spaceshipPanel.locator('button').filter({ hasText: 'Upgrade' });
    await expect(upgradeBtn).toBeVisible();
    await expect(upgradeBtn).toBeEnabled();

    // Click Upgrade button via dispatchEvent
    await upgradeBtn.dispatchEvent('click');
    await page.clock.runFor(500);

    await expect(spaceshipPanel).toContainText('Lv.2', { timeout: 3000 });
  });

  test('spaceship build button disabled without resources', async ({ page }) => {
    await seedAndWaitForSpace(page, {
      resources: {
        eggs: 5, larvae: 3, workers: 80, food: 5000,
        nestCapacity: 100, wood: 0, stone: 0, nectar: 0,
        voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
    });

    const buildBtn = page.locator('#spaceship-panel button').filter({ hasText: 'Build' });
    // Lv.0 spaceship costs 2000 food, 500 wood, 500 stone, 200 nectar
    // With 0 resources, button should be disabled
    await expect(buildBtn).toBeDisabled({ timeout: 5000 });
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

    // Should show planet destination cards (one per planet)
    const planetCards = explorationPanel.locator('.expedition-card');
    const count = await planetCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Launch button should be enabled (ships > 1, scouts > 0)
    // Use .first() — one Launch button per planet (4 destinations)
    const launchBtn = explorationPanel.locator('button').filter({ hasText: 'Launch' }).first();
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toBeEnabled();
  });

  test('exploration launch button disabled without spaceship', async ({ page }) => {
    await seedAndWaitForSpace(page);

    // When no spaceship, the exploration panel shows a hint, no Launch buttons
    await expect(page.locator('#exploration-panel')).toContainText('Build a spaceship first');
  });

  test('launch probe — scouts deducted, probe row appears', async ({ page }) => {
    await seedAndWaitForSpace(page, {
      spaceship: { level: 1, fuel: 100, maxFuel: 100 },
      soldiers: { scouts: 10, warriors: 5, totalKilled: 0 },
    });

    const scoutsBefore = await readGameState(page, 'soldiers.scouts') as number;

    // Click Launch button via evaluate to avoid DOM detachment + strict mode issues
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#exploration-panel button');
      for (const btn of btns) {
        if (btn.textContent?.includes('Launch')) {
          (btn as HTMLButtonElement).click();
          break;
        }
      }
    });
    await page.clock.runFor(500);

    // Scouts deducted (always 1 scout per probe)
    const scoutsAfter = await readGameState(page, 'soldiers.scouts') as number;
    expect(scoutsAfter).toBe(scoutsBefore - 1);

    // Probe row should appear
    const probeRows = page.locator('#exploration-panel .expedition-row');
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

    // Wait for SPACE phase to be re-entered (state is preserved in save)
    await waitForSpacePanels(page);

    // Theme should be re-applied
    hasClass = await page.evaluate(() =>
      document.body.classList.contains('phase-space'),
    );
    expect(hasClass).toBe(true);

    // Both space panels should be visible after reload
    await expect(page.locator('#spaceship-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#exploration-panel')).toBeVisible({ timeout: 5000 });
  });

  // ─── Lazy Panel Loading ───────────────────────────────────────

  test('Phase 4 panels are absent from DOM before space transition', async ({ page }) => {
    // Seed in expansion phase (before SPACE). Use moderate workers/food.
    // Set voidCrystals/antimatter/darkMatter below transcendence thresholds.
    const data = makeSaveData({
      resources: {
        eggs: 5, larvae: 3, workers: 60, food: 4000,
        nestCapacity: 100, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
    });
    // Force phase to expansion in the raw save data to work around migration issue
    (data.gameState as Record<string, unknown>).phase = 'expansion';
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Run a few ticks; nothing taps CONTINUE, so the phase stays in EXPANSION
    await page.clock.runFor(1000);

    // Verify expansion-phase panels exist
    await expect(page.locator('#phase-indicator')).toContainText('Expansion', { timeout: 5000 });

    // Phase 4 lazy panels should NOT exist in the DOM yet
    const starmapExists = await page.locator('#starmap-panel').count();
    expect(starmapExists).toBe(0);

    const converterExists = await page.locator('#resource-converter-panel').count();
    expect(converterExists).toBe(0);
  });

  test('Phase 4 lazy panels appear in DOM after space transition', async ({ page }) => {
    const data = makeSaveData();
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Wait for the SPACE transition (the seed satisfies the guard)
    await waitForSpacePanels(page);

    // Lazy-loaded panels should now exist in the DOM
    const starmapPanel = page.locator('#starmap-panel');
    await expect(starmapPanel).toBeAttached({ timeout: 5000 });

    const converterPanel = page.locator('#resource-converter-panel');
    await expect(converterPanel).toBeAttached({ timeout: 5000 });

    // Phase 5 panels should NOT exist yet in space phase
    const techTreeExists = await page.locator('#tech-tree-panel').count();
    expect(techTreeExists).toBe(0);

    const autoExists = await page.locator('#automation-panel').count();
    expect(autoExists).toBe(0);
  });

  test('createPanel is idempotent — duplicate phase enter does not duplicate DOM', async ({ page }) => {
    const data = makeSaveData();
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Wait for the SPACE transition (the seed satisfies the guard)
    await waitForSpacePanels(page);

    // Count starmap panels after first load
    const count = await page.locator('#starmap-panel').count();
    expect(count).toBe(1);

    // Save and reload to trigger phase re-enter
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
      const state = (swarm.manager as { getState: () => unknown }).getState();
      sm.save(state, Date.now());
    });

    await page.reload();
    await page.waitForSelector('#panels', { timeout: 10000 });
    await waitForSpacePanels(page);

    // After reload, still exactly one starmap-panel
    const countAfterReload = await page.locator('#starmap-panel').count();
    expect(countAfterReload).toBe(1);
  });
});
