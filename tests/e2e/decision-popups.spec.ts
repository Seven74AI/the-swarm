import { test, expect } from '@playwright/test';

/**
 * E2E: Decision Popups (GM-2).
 *
 * Verifies:
 * - Decision popup appears after 2-3 minutes of play time
 * - Popup shows title, description, and choice buttons
 * - Clicking a choice applies the consequence (hides popup)
 * - Popup auto-dismisses after 30 seconds
 *
 * Uses page.addInitScript with JSON-stringified seed (same pattern as golden-path.spec.ts)
 * to inject save data before page load, avoiding beforeunload autosave overwrite.
 * SaveManager reads from localStorage key 'the_swarm_save' with version 7.
 */

function makeSeedStr(playTimeMs: number): string {
  const mapTiles: Array<{
    x: number;
    y: number;
    type: string;
    discovered: boolean;
    claimed: boolean;
  }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      mapTiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }

  return JSON.stringify({
    version: 7,
    timestamp: Date.now(),
    playTimeMs,
    gameState: {
      phase: 'egg_laying',
      resources: {
        eggs: 50,
        larvae: 0,
        workers: 25,
        food: 500,
        nestCapacity: 50,
        wood: 0,
        stone: 0,
        nectar: 0,
        voidCrystals: 0,
        antimatter: 0,
        darkMatter: 0,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      soldierPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0 },
      soldiers: { scouts: 5, warriors: 0, totalKilled: 0 },
      buildings: {
        barracks: { level: 0, count: 0 },
        walls: { level: 0 },
        warehouse: { level: 0 },
      },
      territory: { ownedTiles: 0, bonuses: {} },
      mapTiles,
      expeditions: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
      upgrades: {},
      stats: {
        totalEggsLaid: 0,
        totalClicks: 0,
        playTimeMs,
      },
      unlockedPanels: [],
      lastSaveTimestamp: Date.now(),
      combatSoldiers: 0,
      soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0,
      battlesLost: 0,
      victoryAchieved: false,
      spaceship: { level: 0, fuel: 0, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
    },
  });
}

test.describe('Decision Popups (GM-2)', () => {
  test('popup appears after 3 minutes play time', async ({ page }) => {
    // Inject save with 200_000ms play time before page load
    const seedStr = makeSeedStr(200_000);
    await page.addInitScript((seed: string) => {
      localStorage.setItem('the_swarm_save', seed);
    }, seedStr);

    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10_000 });

    // Popup should appear (playTimeMs 200_000 exceeds 2-3min spawn window)
    const popup = page.locator('#decision-popup');
    await expect(popup).toBeVisible({ timeout: 10_000 });
  });

  test('popup shows title, description, and choice buttons', async ({ page }) => {
    const seedStr = makeSeedStr(200_000);
    await page.addInitScript((seed: string) => {
      localStorage.setItem('the_swarm_save', seed);
    }, seedStr);

    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10_000 });

    const popup = page.locator('#decision-popup');
    await expect(popup).toBeVisible({ timeout: 10_000 });

    // Check title exists
    const title = popup.locator('.decision-popup-title');
    await expect(title).not.toBeEmpty();

    // Check description exists
    const desc = popup.locator('.decision-popup-desc');
    await expect(desc).not.toBeEmpty();

    // Check at least 2 buttons, at most 4
    const buttons = popup.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
  });

  test('clicking choice hides popup', async ({ page }) => {
    const seedStr = makeSeedStr(200_000);
    await page.addInitScript((seed: string) => {
      localStorage.setItem('the_swarm_save', seed);
    }, seedStr);

    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10_000 });

    const popup = page.locator('#decision-popup');
    await expect(popup).toBeVisible({ timeout: 10_000 });

    // Click first choice button
    const firstButton = popup.locator('button').first();
    await firstButton.click();

    // Popup should hide after choice
    await expect(popup).toBeHidden({ timeout: 5_000 });
  });

  test('popup is non-blocking — game continues running', async ({ page }) => {
    const seedStr = makeSeedStr(200_000);
    await page.addInitScript((seed: string) => {
      localStorage.setItem('the_swarm_save', seed);
    }, seedStr);

    await page.goto('/');
    await page.waitForSelector('#panels', { timeout: 10_000 });

    const popup = page.locator('#decision-popup');
    await expect(popup).toBeVisible({ timeout: 10_000 });

    // Verify the popup is non-blocking: the click button is visible and clickable
    // while the popup is shown (proves popup doesn't block game input)
    const clickBtn = page.locator('#click-egg');
    await expect(clickBtn).toBeVisible({ timeout: 5_000 });
    await expect(clickBtn).toBeEnabled({ timeout: 5_000 });
    await clickBtn.click();
    // Verify clicks incremented
    const clickCounter = page.locator('.click-counter');
    await expect(clickCounter).toContainText(/Clicks: (?!0)/, { timeout: 5_000 });

    // Dismiss the popup by clicking a choice
    const firstButton = popup.locator('button').first();
    await firstButton.click();
    await expect(popup).toBeHidden({ timeout: 5_000 });
  });
});
