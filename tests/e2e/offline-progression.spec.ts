import { test, expect } from '@playwright/test';

/**
 * Offline Progression E2E tests (GM-8).
 */

function makeOfflineSaveData(saveTimestamp: number) {
  return {
    version: 9,
    timestamp: saveTimestamp,
    playTimeMs: 60000,
    gameState: {
      phase: 'egg_laying',
      resources: {
        eggs: 10, larvae: 5, workers: 3, food: 50, nestCapacity: 25,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      soldierPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 2, tend: 1, dig: 0, guard: 0 },
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
      buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 0 } },
      territory: { ownedTiles: 0, bonuses: {} },
      mapTiles: [],
      expeditions: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
      upgrades: {},
      stats: { totalEggsLaid: 10, totalClicks: 5, playTimeMs: 60000 },
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button'],
      lastSaveTimestamp: saveTimestamp,
      combatSoldiers: 0,
      soldierStats: { strength: 1.0, defense: 1.0, speed: 5, maxHp: 10 },
      equipment: { weapon: 0, armor: 0 },
      lastBattle: null,
      combatResources: { chitin: 0, silk: 0, venom: 0 },
      battlesWon: 0, battlesLost: 0,
      victoryAchieved: false,
      spaceship: { level: 0, fuel: 0, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
      offlineEfficiency: 0.5,
    },
  };
}

test.describe('Offline Progression', () => {
  test('debug: check popup lifecycle', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => consoleLogs.push(`[PAGE_ERROR] ${err.message}`));

    const ninetySecAgo = Date.now() - 90_000;
    const saveData = makeOfflineSaveData(ninetySecAgo);

    await page.addInitScript((saveStr: string) => {
      localStorage.setItem('the_swarm_save', saveStr);
    }, JSON.stringify(saveData));

    // Also inject error handlers BEFORE load
    await page.addInitScript(() => {
      window.addEventListener('error', (e) => {
        console.log('[INIT_ERROR]', e.message);
      });
      window.addEventListener('unhandledrejection', (e) => {
        console.log('[INIT_REJECTION]', String(e.reason));
      });
    });

    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Dump ALL logs
    for (const log of consoleLogs) {
      console.log('BROWSER:', log);
    }

    // Check DOM state
    const popup = page.locator('.offline-summary-popup');
    const overlay = page.locator('.offline-overlay');
    const popupCount = await popup.count();
    const overlayCount = await overlay.count();
    console.log('Popup count:', popupCount, 'Overlay count:', overlayCount);

    // Check body
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('BODY HTML (first 1000 chars):', bodyHTML.substring(0, 1000));
  });
});
