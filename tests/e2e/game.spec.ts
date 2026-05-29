import { test, expect } from '@playwright/test';

test('click egg button increments counter and spawns particle', async ({ page }) => {
  await page.goto('/');
  // Verify initial egg count is 0 (critical-bar format: "🥚 0")
  const eggDisplay = page.locator('[data-stat="resources.eggs"] .critical-value');
  await expect(eggDisplay).toHaveText('0');

  // No particles before click
  await expect(page.locator('.click-particle')).toHaveCount(0);

  // Click the egg button
  await page.locator('#click-egg').click();

  // Verify count changed
  await expect(eggDisplay).not.toHaveText('0');

  // At least one floating particle spawned
  await expect(page.locator('.click-particle')).toHaveCount(1);
});

test('phase indicator shows initial phase', async ({ page }) => {
  await page.goto('/');
  const indicator = page.locator('#phase-indicator');
  await expect(indicator).toContainText('The Lonely Queen');
});

test('phase transitions from egg_laying to colony', async ({ page }) => {
  // Set save data before page loads so bootstrap picks it up
  await page.addInitScript(() => {
    const data = {
      version: 11,
      timestamp: Date.now(),
      playTimeMs: 0,
      gameState: {
        phase: 'egg_laying',
        resources: { eggs: 0, larvae: 0, workers: 10, food: 0, nestCapacity: 25, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 },
        eggPipeline: { count: 0, progress: 0 },
        larvaPipeline: { count: 0, progress: 0 },
        soldierPipeline: { count: 0, progress: 0 },
        workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
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
      },
    };
    localStorage.setItem('the_swarm_save', JSON.stringify(data));
  });

  await page.goto('/');
  // Wait for a tick to fire (50ms interval, transition within 1s)
  await page.waitForTimeout(2000);
  const indicator = page.locator('#phase-indicator');
  await expect(indicator).toContainText('The Colony');
});

test('save persists across reload', async ({ page }) => {
  await page.goto('/');

  // Click the egg button
  await page.locator('#click-egg').click();
  await page.waitForTimeout(500);

  // Manually trigger save
  await page.evaluate(() => {
    const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
    if (swarm && swarm.saveManager) {
      const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
      const state = (swarm.manager as { getState: () => unknown }).getState();
      sm.save(state, 0);
    }
  });

  await page.reload();
  const eggDisplay = page.locator('[data-stat="resources.eggs"] .critical-value');
  await expect(eggDisplay).not.toHaveText('0');
});
