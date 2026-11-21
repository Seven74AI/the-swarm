import { test, expect } from '@playwright/test';

/**
 * Pause (Story 2.10, FR25, UX-DR33 paused): the top bar's button, P (Story 1.30: Space no
 * longer pauses) and PAUSE in settings stop the ticker and show the `PAUSED` overlay line;
 * the next tap or key resumes, and reaches nothing behind it. Pause is in-session only:
 * it is never saved, and a reload starts unpaused. (Hiding the page ends it: resume-path.spec.)
 *
 * Seed: 5 workers assigned to gather, 100 food. Each tick increases food.
 */

const FOOD_SELECTOR = '[data-stat="resources.food"] .critical-value';
const PAUSE_BUTTON = '#pause-button';
const OVERLAY = '[data-overlay="paused"]';

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

/** The food shown now, once it has settled after a pause (the display can lag a tick). Needs `page.clock.install()`. */
async function settledFood(page: any): Promise<number> {
  await page.clock.runFor(300);
  return getFoodValue(page);
}

const eggsLaid = (page: any): Promise<number> =>
  page.evaluate(() => (window as any).__swarm.manager.getState().stats.totalEggsLaid as number);

test('the pause button shows PAUSED, stops the simulation, and a tap resumes', async ({ page }) => {
  // A fake clock lets the test move time forward on purpose, instead of sleeping.
  await page.clock.install();
  await seedSave(page);
  await page.goto('/');
  await expect.poll(() => getFoodValue(page), { timeout: 10_000 }).toBeGreaterThan(100);

  await page.click(PAUSE_BUTTON);
  await expect(page.locator(OVERLAY)).toBeVisible();
  await expect(page.locator('[data-paused-line]')).toHaveText('PAUSED');
  await expect(page.locator('body')).toHaveClass(/game-paused/);
  await expect(page.locator(PAUSE_BUTTON)).toHaveText('▶');

  // While paused, food must not grow at all, however much time passes.
  const foodBefore = await settledFood(page);
  await page.clock.runFor(2_000);
  expect(await getFoodValue(page)).toBe(foodBefore);

  // The next tap, anywhere, resumes.
  await page.locator(OVERLAY).click({ position: { x: 10, y: 10 } });
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);
  await expect(page.locator(PAUSE_BUTTON)).toHaveText('⏸');
  await expect.poll(() => getFoodValue(page)).toBeGreaterThan(foodBefore);
});

test('Space does not pause (it is the primary action now)', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');
  await expect(page.locator(PAUSE_BUTTON)).toBeAttached();
  await page.keyboard.press('Space');
  // Key handling is synchronous: had Space paused, the body would say so already.
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);
  await expect(page.locator(OVERLAY)).toHaveCount(0);
});

test('P pauses, and the next key resumes without acting behind the overlay', async ({ page }) => {
  await page.clock.install();
  await seedSave(page);
  await page.goto('/');
  await expect(page.locator(PAUSE_BUTTON)).toBeAttached();

  await page.keyboard.press('p');
  await expect(page.locator(OVERLAY)).toBeVisible();
  const foodPaused = await settledFood(page);
  await page.clock.runFor(2_000);
  expect(await getFoodValue(page)).toBe(foodPaused);

  // P again resumes (and doesn't pause again: the overlay swallows the key, synchronously).
  await page.keyboard.press('p');
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/game-paused/);
  await expect.poll(() => getFoodValue(page)).toBeGreaterThan(foodPaused);

  // Space, the primary action, resumes too, and lays no egg on the way.
  await page.keyboard.press('p');
  await expect(page.locator(OVERLAY)).toBeVisible();
  const laid = await eggsLaid(page);
  await page.keyboard.press('Space');
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  expect(await eggsLaid(page)).toBe(laid);
});

test('PAUSE in settings closes the settings and pauses', async ({ page }) => {
  await page.clock.install();
  await seedSave(page);
  await page.goto('/');
  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await expect(page.locator('[data-settings-sheet]')).toBeVisible();

  await page.locator('[data-settings-sheet] [data-action="pause"]').click();
  await expect(page.locator(OVERLAY)).toBeVisible();
  await expect(page.locator('[data-settings-sheet]')).toHaveCount(0);
  const foodPaused = await settledFood(page);
  await page.clock.runFor(2_000);
  expect(await getFoodValue(page)).toBe(foodPaused);

  await page.keyboard.press('Enter');
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  await expect.poll(() => getFoodValue(page)).toBeGreaterThan(foodPaused);
});

test('a pause is never saved', async ({ page }) => {
  await seedSave(page);
  await page.goto('/');
  await page.click(PAUSE_BUTTON);
  await expect(page.locator(OVERLAY)).toBeVisible();
  // A save written while paused (the forced save of a hide) holds no pause.
  await page.evaluate(() => (window as any).__swarm.saveManager.save((window as any).__swarm.manager.getState(), 0, true));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('the_swarm_save')!));
  expect('paused' in saved.gameState).toBe(false);
});

test('reload starts unpaused even if an old save had paused: true', async ({ page }) => {
  // An old save written by a paused game.
  await seedSave(page, { paused: true });
  await page.goto('/');

  await expect(page.locator('body')).not.toHaveClass(/game-paused/);
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  // The game is running: food grows.
  await expect.poll(() => getFoodValue(page)).toBeGreaterThan(100);
});
