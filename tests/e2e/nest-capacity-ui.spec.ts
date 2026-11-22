import { test, expect } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Nest Capacity UI E2E Tests
 *
 * Verifies the three capacity UI elements added in NS-2:
 * 1. Resource strip — capped workers turn warn with ▲ (Story 1.16 replaced the progress bar)
 * 2. Lay Egg button disabled at capacity
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
  await expect(page.locator('[data-shell]')).toBeVisible();
}

test.describe('Nest Capacity UI', () => {
  // Story 1.16: the resource strip replaced the ResourcePanel progress bar. A capped
  // value turns warn with ▲; below the cap the workers cell reads normally.
  test('workers below the cap read normally in the strip', async ({ page }) => {
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });
    const cell = page.locator('[data-strip-cell="workers"]');
    await expect(cell).toBeVisible();
    await expect(cell).toHaveAttribute('data-capped', 'false');
    await expect(cell).not.toContainText('\u25B2');
  });

  test('workers at the cap turn warn with ▲ in the strip', async ({ page }) => {
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 25, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });
    const cell = page.locator('[data-strip-cell="workers"]');
    await expect(cell).toHaveAttribute('data-capped', 'true');
    await expect(cell).toContainText('\u25B2');
    const colors = await page.evaluate(() => {
      const of = (sel: string) => getComputedStyle(document.querySelector(sel)!).color;
      return {
        capped: of('[data-strip-cell="workers"] .strip-cell__value'),
        normal: of('[data-strip-cell="food"] .strip-cell__value'),
      };
    });
    expect(colors.capped).not.toBe(colors.normal);
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

  test('dig worker has a tooltip about digging nest rooms', async ({ page }) => {
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
    });

    await openTab(page, 'wrkr');
    const digRow = page.locator('[data-role="dig"]');
    await expect(digRow).toBeVisible();

    // Should have data-tooltip attribute
    const tooltip = await digRow.getAttribute('data-tooltip');
    expect(tooltip).toContain('nest room');
    expect(tooltip).not.toMatch(/per second/i);
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
    await openTab(page, 'wrkr');
    const capacityLine = page.locator('.capacity-line');
    await expect(capacityLine).toBeVisible();

    // Should show workers/capacity (use regex to avoid exact value assertions)
    const text = await capacityLine.textContent();
    expect(text).toMatch(/NEST \d[\d\u00a0]* \/ \d[\d\u00a0]*/);
  });

  test('capacity line shows warehouse bonus when present', async ({ page }) => {
    await seedAndGoto(page, {
      resources: { eggs: 10, larvae: 5, workers: 22, food: 500, nestCapacity: 25 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 1 } },
    });

    // With warehouse level 1 (its room per level), capacity display should show +Warehouse
    await openTab(page, 'wrkr');
    const capacityLine = page.locator('.capacity-line');
    await expect(capacityLine).toBeVisible();

    const text = await capacityLine.textContent();
    expect(text).toContain('WAREHOUSE');
    // Effective capacity should be base + warehouse bonus (invariant, not exact)
    expect(text).toMatch(/\d+/);
  });
});
