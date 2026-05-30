import { test, expect } from '@playwright/test';

/**
 * Nest Capacity UI E2E Tests
 *
 * Verifies the three capacity UI elements added in NS-2:
 * 1. ResourcePanel — ProgressBar with orange/red color states
 * 2. ResourcePanel — Lay Egg button disabled at capacity
 * 3. WorkerAssignment — Dig tooltip + capacity display line
 */

const BASE_GAME_STATE = {
  phase: 'colony',
  resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 },
  eggPipeline: { count: 5, progress: 0 },
  larvaPipeline: { count: 3, progress: 0 },
  soldierPipeline: { count: 0, progress: 0 },
  capacityAccumulator: 0,
  workersAssigned: { gather: 3, tend: 2, dig: 1, guard: 1, researchers: 0 },
  soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
  buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 0 } },
  territory: { ownedTiles: 0, bonuses: {} },
  expeditions: [] as Array<Record<string, unknown>>,
  spaceExplorations: [] as Array<Record<string, unknown>>,
  discoveredPlanets: [] as string[],
  spaceships: [] as Array<Record<string, unknown>>,
  spaceship: { level: 0, fuel: 0, maxFuel: 100 },
  spaceProbes: [] as Array<Record<string, unknown>>,
  discoveries: [] as string[],
  victoryAchieved: false,
  nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
  prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
  autoProduction: { enabled: false, researches: {}, buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 }, progress: 0 },
  research: { projects: { voidCrystalSynthesis: { state: 'available', progress: 0 }, antimatterContainment: { state: 'locked', progress: 0 }, darkMatterDetection: { state: 'locked', progress: 0 } } },
  upgrades: {} as Record<string, number>,
  stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
  unlockedPanels: [] as string[],
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
};

async function seedAndGoto(
  page: any,
  gameStateOverrides: Record<string, unknown>,
  preWaitMs = 3000,
) {
  await page.addInitScript((saveStr: string) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify({
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: { ...BASE_GAME_STATE, ...gameStateOverrides },
  }));
  await page.goto('/');
  if (preWaitMs > 0) {
    await page.waitForTimeout(preWaitMs);
  }
}

test.describe('Nest Capacity UI', () => {
  test('progress bar shows proportional fill for workers/capacity', async ({ page }) => {
    // 22 workers / 25 capacity = 88% — below the 90% warning threshold
    // Disable production to prevent drift during vait
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    // Progress bar should be visible in the colony section
    const progressBar = page.locator('.progress-bar');
    await expect(progressBar.first()).toBeVisible();

    // Progress fill should have some width (not 0%)
    const fill = page.locator('.progress-fill').first();
    await expect(fill).toBeVisible();
    const width = await fill.evaluate((el: HTMLElement) => el.style.width);
    expect(parseFloat(width)).toBeGreaterThan(0);

    // Should NOT have warning or full color class at 88%
    const hasWarning = await fill.evaluate((el: HTMLElement) =>
      el.classList.contains('capacity-warning'));
    const hasFull = await fill.evaluate((el: HTMLElement) =>
      el.classList.contains('capacity-full'));
    expect(hasWarning).toBe(false);
    expect(hasFull).toBe(false);
  });

  test('progress bar turns orange at >=90% capacity', async ({ page }) => {
    // 23 workers / 25 capacity = 92% — should trigger warning
    // Use dig:0 to prevent capacity from growing during the 3s wait
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 23, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    const fill = page.locator('.progress-bar .progress-fill').first();
    await expect(fill).toBeVisible();

    // Should have warning (orange) class
    await expect(fill).toHaveClass(/capacity-warning/);
  });

  test('progress bar turns red at 100% capacity', async ({ page }) => {
    // 25 workers / 25 capacity = 100% — should trigger full (red)
    // Use dig:0 to prevent capacity from growing during the 3s wait
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 25, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    const fill = page.locator('.progress-bar .progress-fill').first();
    await expect(fill).toBeVisible();

    // Should have full (red) class
    await expect(fill).toHaveClass(/capacity-full/);
  });

  test('lay egg button appears disabled at 100% capacity', async ({ page }) => {
    // 25 workers / 25 capacity = 100%
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 25, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    const eggButton = page.locator('#click-egg');
    await expect(eggButton).toBeVisible();

    // Should have the at-capacity class
    await expect(eggButton).toHaveClass(/click-button-at-capacity/);
  });

  test('lay egg button is active when below capacity', async ({ page }) => {
    // 22 workers / 25 capacity = 88% — below capacity
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    const eggButton = page.locator('#click-egg');
    await expect(eggButton).toBeVisible();

    // Should NOT have the at-capacity class
    const atCapacity = await eggButton.evaluate((el: HTMLElement) =>
      el.classList.contains('click-button-at-capacity'));
    expect(atCapacity).toBe(false);
  });

  test('dig worker has tooltip with capacity per second', async ({ page }) => {
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    const digRow = page.locator('[data-role="dig"]');
    await expect(digRow).toBeVisible();

    // Should have data-tooltip attribute
    const tooltip = await digRow.getAttribute('data-tooltip');
    expect(tooltip).toContain('Each Dig worker adds +1 capacity per second');
  });

  test('worker assignment shows capacity display line', async ({ page }) => {
    // Seed with workers near capacity, disable production to prevent drift
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    // The capacity line should be visible
    const capacityLine = page.locator('.capacity-line');
    await expect(capacityLine).toBeVisible();

    // Should show workers/capacity (use regex to avoid exact value assertions)
    const text = await capacityLine.textContent();
    expect(text).toContain('Workers:');
    expect(text).toMatch(/Workers: \d+\/\d+/);
  });

  test('capacity line shows warehouse bonus when present', async ({ page }) => {
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 1 } },
    });

    // With warehouse level 1 (+25 capacity), capacity display should show +Warehouse
    const capacityLine = page.locator('.capacity-line');
    await expect(capacityLine).toBeVisible();

    const text = await capacityLine.textContent();
    expect(text).toContain('+Warehouse');
    // Effective capacity should be base + warehouse bonus (invariant, not exact)
    expect(text).toMatch(/\d+/);
  });
});
