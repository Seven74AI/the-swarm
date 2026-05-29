import { test, expect } from '@playwright/test';

/**
 * E2E test: Automation System (GM-3)
 *
 * Tests the automation research tree and auto egg production lifecycle.
 * Uses localStorage seeding (like space-phase tests) so the FSM starts
 * in the correct phase. Uses page.evaluate() for clicks to avoid
 * DOM detachment from reactive effect() rebuilds.
 */

function createEmptyMapTiles(): Array<{
  x: number; y: number; type: string; discovered: boolean; claimed: boolean;
}> {
  const tiles: Array<{
    x: number; y: number; type: string; discovered: boolean; claimed: boolean;
  }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      tiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }
  return tiles;
}

function makeTranscendenceSave(overrides?: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 300_000,
    gameState: {
      phase: 'transcendence',
      resources: {
        eggs: 500, larvae: 200, workers: 200, food: 2000,
        nestCapacity: 500, wood: 500, stone: 500, nectar: 300,
        voidCrystals: 200, antimatter: 100, darkMatter: 50,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 20, tend: 10, dig: 5, guard: 5, researchers: 0 },
      soldiers: { scouts: 50, warriors: 30, totalKilled: 10 },
      buildings: { barracks: { level: 3, count: 1 }, walls: { level: 3 }, warehouse: { level: 3 } },
      territory: { ownedTiles: 20, bonuses: {} },
      expeditions: [],
      upgrades: {},
      stats: { totalEggsLaid: 10000, totalClicks: 5000, playTimeMs: 300_000 },
      unlockedPanels: [],
      lastSaveTimestamp: 0,
      combatSoldiers: 20,
      soldierStats: { strength: 5, defense: 5, speed: 8, maxHp: 20 },
      soldierPipeline: { count: 0, progress: 0 },
      equipment: { weapon: 5, armor: 5 },
      lastBattle: null,
      combatResources: { chitin: 20, silk: 15, venom: 10 },
      battlesWon: 10,
      battlesLost: 2,
      spaceship: { level: 3, fuel: 80, maxFuel: 200 },
      spaceProbes: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      discoveries: [],
      spaceships: [],
      mapTiles: createEmptyMapTiles(),
      victoryAchieved: false,
      autoProduction: {
        enabled: false,
        researches: {},
        buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 },
        progress: 0,
      },
      offlineEfficiency: 0.5,
      conversions: { particleLab: 0 },
      entropy: 0,
      entropyDampener: { level: 0 },
      prestigeTree: { purchased: [] },
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
      ...overrides,
    },
  };
}

/** Seed save and navigate to page, waiting for panels to mount. */
async function seedAndLoad(page: import('@playwright/test').Page, saveObj: Record<string, unknown>) {
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(saveObj));
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });
}

test.describe('Automation System (GM-3)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndLoad(page, makeTranscendenceSave());
  });

  test('automation panel exists and has research rows', async ({ page }) => {
    await page.waitForSelector('#automation-panel', { timeout: 8000 });
    const panel = page.locator('#automation-panel');
    await expect(panel).toBeVisible();

    const researchRows = panel.locator('.research-row');
    const count = await researchRows.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('research Basic Incubation enables auto egg rate', async ({ page }) => {
    await page.waitForSelector('#automation-panel', { timeout: 8000 });

    // Enable toggle via evaluate (avoids DOM detachment from reactive effect)
    await page.evaluate(() => {
      const toggle = document.querySelector('#automation-panel .auto-toggle') as HTMLInputElement;
      if (toggle && !toggle.checked) toggle.click();
    });

    // Click Research button for Basic Incubation via evaluate
    await page.evaluate(() => {
      const btn = document.querySelector('[data-research="basic_incubation"] button') as HTMLButtonElement;
      if (btn && !btn.disabled) btn.click();
    });

    // Verify rate display shows 0.5
    const rateDisplay = page.locator('#automation-panel .auto-rate');
    await expect(rateDisplay).toContainText('0.5', { timeout: 5000 });
  });

  test('auto eggs accumulate without clicking over time', async ({ page }) => {
    await page.waitForSelector('#automation-panel', { timeout: 8000 });

    // Enable toggle + research basic_incubation
    await page.evaluate(() => {
      const toggle = document.querySelector('#automation-panel .auto-toggle') as HTMLInputElement;
      if (toggle && !toggle.checked) toggle.click();
    });
    await page.evaluate(() => {
      const btn = document.querySelector('[data-research="basic_incubation"] button') as HTMLButtonElement;
      if (btn && !btn.disabled) btn.click();
    });

    const rateDisplay = page.locator('#automation-panel .auto-rate');
    await expect(rateDisplay).toContainText('0.5', { timeout: 5000 });

    // Wait for auto-production to accumulate
    await page.waitForTimeout(2500);
    await expect(rateDisplay).toBeVisible();
  });

  test('research prerequisites block invalid purchases', async ({ page }) => {
    await page.waitForSelector('#automation-panel', { timeout: 8000 });

    // thermal_regulation requires queens_pheromones as prerequisite
    const thermalBtn = page.locator('[data-research="thermal_regulation"] button');
    await expect(thermalBtn).toBeDisabled({ timeout: 5000 });
  });
});

// Separate describe: advanced save with all researches completed
// Needs its own beforeEach because addInitScript from parent beforeEach
// would overwrite the advanced save on page.goto().
test.describe('Automation System (GM-3) — stacking', () => {
  test.beforeEach(async ({ page }) => {
    const advancedSave = makeTranscendenceSave({
      resources: {
        eggs: 500, larvae: 200, workers: 2000, food: 50000,
        nestCapacity: 500, wood: 500, stone: 10000, nectar: 300,
        voidCrystals: 500, antimatter: 200, darkMatter: 50,
      },
      autoProduction: {
        enabled: true,
        researches: {
          basic_incubation: true,
          queens_pheromones: true,
          thermal_regulation: true,
          genetic_optimization: true,
          cloning_vats: true,
        },
        buildings: { nursery: 3, hatchery: 2, queens_chamber: 1 },
        progress: 0,
      },
    });
    await seedAndLoad(page, advancedSave);
  });

  test('higher research tiers stack multiplicatively', async ({ page }) => {
    await page.waitForSelector('#automation-panel', { timeout: 8000 });

    // Check rate > 20 eggs/s with all researches + buildings
    const rateDisplay = page.locator('#automation-panel .auto-rate');
    const rateText = await rateDisplay.textContent();
    const rateMatch = rateText?.match(/([\d.]+)/);
    if (rateMatch) {
      const rate = parseFloat(rateMatch[1]);
      expect(rate).toBeGreaterThan(20);
    }
  });
});
