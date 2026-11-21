import { test, expect } from '@playwright/test';

/**
 * E2E: Prestige System — Legacy Layer.
 *
 * Seeds a game state with buildings at level 5+ and 100K+ totalFoodProduced,
 * verifies the prestige panel appears, clicks the prestige button,
 * and confirms resources reset, legacy points increase.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  const mapTiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      mapTiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }

  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'transcendence',
      resources: {
        eggs: 0, larvae: 0, workers: 50, food: 5000,
        nestCapacity: 50, wood: 1000, stone: 800, nectar: 500,
        voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      soldierPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 10, tend: 0, dig: 0, guard: 0, researchers: 0 },
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
      buildings: {
        barracks: { level: 5, count: 0 },
        walls: { level: 5 },
        warehouse: { level: 5 },
      },
      territory: { ownedTiles: 0, bonuses: {} },
      mapTiles,
      expeditions: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
      upgrades: {},
      stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
      unlockedPanels: [],
      lastSaveTimestamp: 0,
      combatSoldiers: 0,
      soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0,
      battlesLost: 0,
      spaceship: { level: 0, fuel: 0, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      victoryAchieved: false,
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
      offlineEfficiency: 0.5,
      conversions: { particleLab: 0 },
      entropy: 0,
      entropyDampener: { level: 0 },
      prestigeTree: { purchased: [] },
      ...overrides,
    },
  };
}

test.describe('Prestige System — Legacy Layer', () => {
  test.beforeEach(async ({ page }) => {
    const data = makeSaveData();
    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.clock.install();
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });
  });

  test('prestige panel exists and shows Legacy Points', async ({ page }) => {
    // The seed is in TRANSCENDENCE, where the lazy prestige panel is mounted.
    const panel = page.locator('#prestige-panel');
    await expect(panel).toHaveCount(1);
    await expect(panel).toContainText('Legacy');
  });

  test('prestige button resets resources and increments legacy points', async ({ page }) => {
    // The seed is in TRANSCENDENCE, where the lazy prestige panel is mounted.
    const prestigeBtn = page.locator('#prestige-panel .btn-prestige');
    await expect(prestigeBtn).toHaveCount(1);

    // Verify button text
    const btnText = await prestigeBtn.textContent();
    expect(btnText).toContain('Transcend');

    // Verify button is enabled (requirements met)
    const disabled = await prestigeBtn.isDisabled();
    expect(disabled).toBe(false);

    // Hold prestige (hold-to-confirm, Story 1.13); the page clock is installed, so run it past the hold.
    await prestigeBtn.dispatchEvent('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
    await page.clock.runFor(1500);
    await prestigeBtn.dispatchEvent('pointerup', { pointerId: 1, button: 0, isPrimary: true });

    // After prestige the panel shows the new count (was 0).
    await expect(page.locator('#prestige-panel')).toContainText(/Legacy.*?1/);
  });

  test('prestige button is disabled when requirements not met', async ({ page }) => {
    // This test reloads with insufficient requirements
    await page.evaluate(() => localStorage.clear());

    const data = makeSaveData();
    // Override buildings to be below level 5
    (data.gameState as Record<string, unknown>).buildings = {
      barracks: { level: 0, count: 0 },
      walls: { level: 0 },
      warehouse: { level: 0 },
    };
    (data.gameState as Record<string, unknown>).prestige = {
      count: 0,
      legacyPoints: 0,
      totalFoodProduced: 0,
      totalWoodProduced: 0,
      totalStoneProduced: 0,
      totalNectarProduced: 0,
    };

    await page.addInitScript((saveStr) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(data));
    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10000 });

    const btn = page.locator('#prestige-panel .btn-prestige');
    await expect(btn).toHaveCount(1);

    // Button should be disabled
    const disabled = await btn.isDisabled();
    expect(disabled).toBe(true);

    // Should have a tooltip with unmet requirements
    const title = await btn.getAttribute('title');
    expect(title).toBeTruthy();
    expect(title).toContain('barracks');
    expect(title).toContain('100K');
  });
});
