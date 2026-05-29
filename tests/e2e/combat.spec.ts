import { test, expect, type Page } from '@playwright/test';

function makeSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'combat',
      resources: { eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
      workersAssigned: { gather: 4, tend: 4, dig: 4, guard: 4, researchers: 0 },
      upgrades: {},
      stats: { totalEggsLaid: 50, totalClicks: 100, playTimeMs: 0 },
      unlockedPanels: ['resource_panel', 'soldier_panel', 'battle_panel'],
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      lastSaveTimestamp: Date.now(),
      combatSoldiers: 0,
      soldierStats: { strength: 1, defense: 1, speed: 5, maxHp: 10 },
      soldierPipeline: { count: 0, progress: 0 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0,
      battlesLost: 0,
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
      buildings: {
        barracks: { level: 0, count: 0 },
        walls: { level: 0 },
        warehouse: { level: 0 },
      },
      territory: { ownedTiles: 0, bonuses: {} },
      // mapTiles omitted — let createInitialState() default provide 64 tiles
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
 * Setup combat phase by injecting save data before page load.
 * Uses addInitScript to avoid beforeunload overwriting localStorage.
 */
async function setupCombatPhase(page: Page, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));

  await page.goto('/');
  await page.waitForTimeout(2000);
}

test.describe('Combat', () => {
  test('phase transitions to COMBAT with 15 workers and guard', async ({ page }) => {
    await page.addInitScript(() => {
      const data = {
        version: 11,
        timestamp: Date.now(),
        playTimeMs: 0,
        gameState: {
          phase: 'egg_laying',
          resources: { eggs: 0, larvae: 0, workers: 15, food: 1000, nestCapacity: 25, wood: 0, stone: 0, nectar: 0 },
          eggPipeline: { count: 0, progress: 0 },
          larvaPipeline: { count: 0, progress: 0 },
          workersAssigned: { gather: 10, tend: 2, dig: 2, guard: 1, researchers: 0 },
          upgrades: {},
          stats: { totalEggsLaid: 50, totalClicks: 100, playTimeMs: 0 },
          unlockedPanels: [],
          lastSaveTimestamp: 0,
          combatSoldiers: 0,
          soldierStats: { strength: 1, defense: 1, speed: 5, maxHp: 10 },
          soldierPipeline: { count: 0, progress: 0 },
          equipment: { weapon: 0, armor: 0 },
          lastBattle: null,
          combatResources: { chitin: 0, silk: 0, venom: 0 },
          battlesWon: 0,
          battlesLost: 0,
          soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
          buildings: {
            barracks: { level: 0, count: 0 },
            walls: { level: 0 },
            warehouse: { level: 0 },
          },
          territory: { ownedTiles: 0, bonuses: {} },
          // mapTiles omitted — let createInitialState() default provide 64 tiles
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
          autoProduction: {
            enabled: false,
            researches: {},
            buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 },
            progress: 0,
          },
          research: {
            projects: {
              voidCrystalSynthesis: { state: 'available', progress: 0 },
              antimatterContainment: { state: 'locked', progress: 0 },
              darkMatterDetection: { state: 'locked', progress: 0 },
            },
          },
          conversions: { particleLab: 0 },
          offlineEfficiency: 0.5,
          entropy: 0,
          entropyDampener: { level: 0 },
          prestigeTree: { purchased: [] },
        },
      };
      localStorage.setItem('the_swarm_save', JSON.stringify(data));
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('War', { timeout: 5000 });
  });

  test('recruit soldier deducts food and shows training', async ({ page }) => {
    await setupCombatPhase(page);
    const foodDisplay = page.locator('[data-stat="resources.food"]');
    await expect(foodDisplay).toBeVisible({ timeout: 5000 });

    const recruitBtn = page.locator('#soldier-panel button').filter({ hasText: 'Recruit Soldier' });
    await expect(recruitBtn).toBeVisible({ timeout: 5000 });
    await recruitBtn.click();

    await expect(page.locator('#soldier-panel .stat-row .stat-sub').first()).not.toBeEmpty({ timeout: 2000 });
  });

  test('scout reveals enemy and enables engage', async ({ page }) => {
    await setupCombatPhase(page, { combatSoldiers: 1 });

    const scoutBtn = page.locator('#scout-enemy');
    await expect(scoutBtn).toBeVisible({ timeout: 5000 });
    await expect(scoutBtn).toBeEnabled({ timeout: 3000 });
    await scoutBtn.click();

    const enemyName = page.locator('#enemy-name');
    await expect(enemyName).toBeVisible({ timeout: 3000 });
    await expect(enemyName).not.toBeEmpty();

    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).toBeEnabled({ timeout: 3000 });
  });

  test('battle resolves with result', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 100,
      equipment: { weapon: 5, armor: 5 },
    });

    const scoutBtn = page.locator('#scout-enemy');
    await expect(scoutBtn).toBeVisible({ timeout: 5000 });
    await expect(scoutBtn).toBeEnabled({ timeout: 3000 });
    await scoutBtn.click();

    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).toBeEnabled({ timeout: 3000 });
    await engageBtn.click();

    const result = page.locator('#battle-result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText(/Victory|Defeat/);
  });

  test('combat resources display after victory', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 50,
      equipment: { weapon: 5, armor: 5 },
    });

    const scoutBtn = page.locator('#scout-enemy');
    await expect(scoutBtn).toBeVisible({ timeout: 5000 });
    await expect(scoutBtn).toBeEnabled({ timeout: 3000 });
    await scoutBtn.click();

    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).toBeEnabled({ timeout: 3000 });
    await engageBtn.click();

    const result = page.locator('#battle-result');
    await expect(result).toBeVisible({ timeout: 5000 });

    await expect(page.locator('#activity-log')).toContainText(/Scouts report|march to meet|soldiers defeated|soldiers were slaughtered/, { timeout: 5000 });

    const continueBtn = page.locator('#battle-continue');
    if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueBtn.click();
      await expect(page.locator('#scout-enemy')).toBeEnabled({ timeout: 5000 });
      await expect(page.locator('#engage-battle')).toBeDisabled({ timeout: 3000 });
    }
  });
});
