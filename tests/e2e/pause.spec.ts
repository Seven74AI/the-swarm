import { test, expect } from '@playwright/test';

/**
 * E2E tests for pause/resume functionality (Slice 2/2).
 * Covers: pause button, Space shortcut, UI dimming, reload unpauses.
 *
 * Dependencies: Slice 1/2 (pause engine + state + UI button) must be merged.
 * Seed: 5 workers assigned to gather, 100 food. Each tick increases food.
 */

const FOOD_SELECTOR = '[data-stat="resources.food"] .critical-value';
const PAUSE_BUTTON = '#pause-button';

/** Parses the food value text (format: "🍽 100" or "🍽 1.2K") to a number. */
async function getFoodValue(page: any): Promise<number> {
  const text = await page.locator(FOOD_SELECTOR).textContent();
  return parseFloat(text?.replace(/[^0-9.]/g, '') ?? '0');
}

/** Seed a save file in localStorage BEFORE page.goto. */
async function seedSave(page: any, overrides: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((extra: Record<string, unknown>) => {
    const state: Record<string, unknown> = {
      version: 11,
      timestamp: Date.now(),
      playTimeMs: 0,
      gameState: {
        phase: 'egg_laying',
        resources: { eggs: 0, larvae: 0, workers: 5, food: 100, nestCapacity: 25, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 },
        eggPipeline: { count: 0, progress: 0 },
        larvaPipeline: { count: 0, progress: 0 },
        soldierPipeline: { count: 0, progress: 0 },
        workersAssigned: { gather: 5, tend: 0, dig: 0, guard: 0, researchers: 0 },
        soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
        buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 0 } },
        territory: { ownedTiles: 0, bonuses: {} },
        expeditions: [],
        spaceExplorations: [],
        discoveredPlanets: [],
        spaceships: [],
        spaceship: { level: 0, fuel: 0, maxFuel: 100 },
        spaceProbes: [],
        discoveries: [],
        victoryAchieved: false,
        nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
        prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
        autoProduction: { enabled: false, researches: {}, buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 }, progress: 0 },
        research: { projects: { voidCrystalSynthesis: { state: 'available', progress: 0 }, antimatterContainment: { state: 'locked', progress: 0 }, darkMatterDetection: { state: 'locked', progress: 0 } } },
        upgrades: {},
        stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
        unlockedPanels: [],
        lastSaveTimestamp: 0,
        combatSoldiers: 0,
        soldierStats: { strength: 1, defense: 1, speed: 5, maxHp: 10 },
        equipment: { weapon: 0, armor: 0 },
        lastBattle: null,
        combatResources: { chitin: 0, silk: 0, venom: 0 },
        battlesWon: 0,
        battlesLost: 0,
        conversions: { particleLab: 0 },
        offlineEfficiency: 0.5,
        entropy: 0,
        entropyDampener: { level: 0 },
        prestigeTree: { purchased: [] },
        paused: false,
        ...extra,
      },
    };
    localStorage.setItem('the_swarm_save', JSON.stringify(state));
  }, overrides);
}

test('click pause button stops food production', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');

  // Wait for a few ticks so food increases from 100
  await page.waitForTimeout(350);
  const foodBefore = await getFoodValue(page);
  expect(foodBefore).toBeGreaterThan(100);

  // Click pause
  await page.click(PAUSE_BUTTON);

  // Wait — food should barely change while paused (allow 1-2 ticks already in rAF queue)
  await page.waitForTimeout(500);
  const foodPaused = await getFoodValue(page);
  const foodIncrease = foodPaused - foodBefore;
  expect(foodIncrease).toBeLessThanOrEqual(2);
});

test('click resume restarts food production', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');

  // Pause first
  await page.click(PAUSE_BUTTON);
  await page.waitForTimeout(200);
  const foodPaused = await getFoodValue(page);

  // Resume
  await page.click(PAUSE_BUTTON);

  // Wait — food should increase after resume
  await page.waitForTimeout(500);
  const foodAfter = await getFoodValue(page);
  expect(foodAfter).toBeGreaterThan(foodPaused);
});

test('Space bar toggles pause', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');

  // Press Space to pause
  await page.keyboard.press('Space');

  // Verify body has game-paused class
  await expect(page.locator('body')).toHaveClass(/game-paused/);

  // Take food reading while paused — should barely change
  const foodPaused = await getFoodValue(page);
  await page.waitForTimeout(300);
  const foodStillPaused = await getFoodValue(page);
  const foodDiff = foodStillPaused - foodPaused;
  expect(foodDiff).toBeLessThanOrEqual(2);

  // Press Space again to resume
  await page.keyboard.press('Space');

  // Verify game-paused class removed
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);

  // Food should increase after resume
  await page.waitForTimeout(500);
  const foodAfter = await getFoodValue(page);
  expect(foodAfter).toBeGreaterThan(foodStillPaused);
});

test('UI dims when paused', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');

  // Game starts unpaused
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);

  // Click pause
  await page.click(PAUSE_BUTTON);

  // Body should have game-paused class (CSS dims panels)
  await expect(page.locator('body')).toHaveClass(/game-paused/);

  // Pause button icon should change
  await expect(page.locator(PAUSE_BUTTON)).toHaveText('▶');

  // Resume
  await page.click(PAUSE_BUTTON);

  // Dimming removed, icon restored
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);
  await expect(page.locator(PAUSE_BUTTON)).toHaveText('⏸');
});

test('reload starts unpaused even if save had paused: true', async ({ page }) => {
  // Seed a save that is paused
  await seedSave(page, { paused: true });
  await page.goto('/');

  // main.ts force-unpauses on load — game should be running
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);

  // Food should increase (game is running, not paused)
  await page.waitForTimeout(500);
  const food = await getFoodValue(page);
  expect(food).toBeGreaterThan(100);
});
