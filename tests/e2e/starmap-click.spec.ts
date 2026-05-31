import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Exploration Map Tiles — click + hover on StarmapPanel planet cards.
 * Seeds a SPACE-phase save with some discovered planets, then tests:
 * - Clicking green (discovered) tile → planet info in Activity Log
 * - Clicking red (undiscovered) tile → requirement explanation in Activity Log
 * - Hover → data-tooltip attribute present on cards
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'space' as const,
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
      spaceship: { level: 1, fuel: 50, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      discoveredPlanets: ['MARS', 'SATURN'],
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

/**
 * Navigate to the starmap by seeding a SPACE-phase save.
 * Uses `phase: 'space'` directly to skip the transition sequence.
 */
async function goToStarmap(page: Page) {
  const data = makeSaveData();
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.clock.install();
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });

  // Allow a few ticks for rendering
  await page.clock.runFor(500);

  // Verify starmap panel is visible
  await expect(page.locator('#starmap-panel')).toBeAttached({ timeout: 5000 });
}

test.describe('Starmap Planet Cards — Click & Tooltip', () => {
  test('discovered planet click shows info in Activity Log', async ({ page }) => {
    await goToStarmap(page);

    // Click the first discovered planet card (MARS — has no 'undiscovered' class)
    const discoveredCard = page.locator('#starmap-panel .expedition-card:not(.undiscovered)').first();
    await expect(discoveredCard).toBeVisible({ timeout: 5000 });
    await discoveredCard.click();

    // Activity Log should contain the planet info
    const eventLog = page.locator('#activity-log');
    await expect(eventLog).toContainText('MARS', { timeout: 5000 });
    await expect(eventLog).toContainText('Antimatter');
    await expect(eventLog).toContainText('rocky');
  });

  test('discovered planet card has data-tooltip with yields', async ({ page }) => {
    await goToStarmap(page);

    const discoveredCard = page.locator('#starmap-panel .expedition-card:not(.undiscovered)').first();
    const tooltip = await discoveredCard.getAttribute('data-tooltip');
    expect(tooltip).toContain('Discovered');
    expect(tooltip).toContain('MARS');
    expect(tooltip).toContain('Antimatter');
  });

  test('undiscovered planet click shows requirement in Activity Log', async ({ page }) => {
    await goToStarmap(page);

    // Click an undiscovered planet card (EUROPA — has 'undiscovered' class)
    const undisCard = page.locator('#starmap-panel .expedition-card.undiscovered').first();
    await expect(undisCard).toBeVisible({ timeout: 5000 });
    await undisCard.click();

    // Activity Log should contain the undiscovered explanation
    const eventLog = page.locator('#activity-log');
    await expect(eventLog).toContainText('undiscovered', { timeout: 5000 });
  });

  test('undiscovered planet card has data-tooltip with requirement', async ({ page }) => {
    await goToStarmap(page);

    const undisCard = page.locator('#starmap-panel .expedition-card.undiscovered').first();
    const tooltip = await undisCard.getAttribute('data-tooltip');
    expect(tooltip).toContain('Undiscovered');
    expect(tooltip).toContain('spaceship');
  });

  test('undiscovered planet card has red styling', async ({ page }) => {
    await goToStarmap(page);

    const undisCard = page.locator('#starmap-panel .expedition-card.undiscovered').first();
    await expect(undisCard).toBeVisible({ timeout: 5000 });

    // Check it has the undiscovered class
    const classes = await undisCard.getAttribute('class');
    expect(classes).toContain('undiscovered');
  });

  test('all planet cards have cursor:pointer', async ({ page }) => {
    await goToStarmap(page);

    const cards = page.locator('#starmap-panel .expedition-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const cursor = await cards.nth(i).evaluate((el) => getComputedStyle(el).cursor);
      expect(cursor).toBe('pointer');
    }
  });

  test('four planet cards exist in starmap', async ({ page }) => {
    await goToStarmap(page);

    const cards = page.locator('#starmap-panel .expedition-card');
    await expect(cards).toHaveCount(4);
  });

  test('correct count of discovered and undiscovered cards', async ({ page }) => {
    await goToStarmap(page);

    // MARS + SATURN discovered, EUROPA + KEPLER-442B undiscovered
    const discovered = page.locator('#starmap-panel .expedition-card:not(.undiscovered)');
    const undiscovered = page.locator('#starmap-panel .expedition-card.undiscovered');

    await expect(discovered).toHaveCount(2);
    await expect(undiscovered).toHaveCount(2);
  });
});
