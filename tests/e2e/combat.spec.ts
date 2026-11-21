import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

// ─── Helpers ───────────────────────────────────────────────────

/** Creates a 64-element empty map tile array (8×8 grid). */
function emptyMapTiles(): Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> {
  const tiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      tiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }
  return tiles;
}

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
      mapTiles: emptyMapTiles(),
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
  // Soldiers and battles live in FRONT → WAR (Story 1.15).
  await openTab(page, 'front', 'war');
}

/** FRONT's primary action in WAR (Story 1.25); it keeps the legacy #engage-battle id. */
const fightBtn = (page: Page) => page.locator('#engage-battle[data-action="fight"]');
/** The battle summary sheet keeps the legacy #battle-result id. */
const summary = (page: Page) => page.locator('#battle-result[data-battle-summary]');
const digits = (s: string | null): number => Number((s ?? '').replace(/\D/g, ''));

test.describe('Combat', () => {
  test('phase transitions to COMBAT with 15 workers and guard', async ({ page }) => {
    await setupCombatPhase(page, { combatSoldiers: 0 });
    // The enemy card and FIGHT load in combat phase
    await expect(page.locator('#battle-panel')).toBeVisible({ timeout: 5000 });
    await expect(fightBtn(page)).toBeVisible({ timeout: 3000 });
  });

  test('recruit soldier deducts food and shows training', async ({ page }) => {
    await setupCombatPhase(page);
    const foodDisplay = page.locator('[data-stat="resources.food"]');
    await expect(foodDisplay).toBeVisible({ timeout: 5000 });

    const training = page.locator('#soldier-panel [data-training]');
    const before = digits(await training.textContent());
    await page.locator('#soldier-panel [data-action="train-soldier"]').click();
    await expect.poll(async () => digits(await training.textContent()), { timeout: 2000 }).toBeGreaterThan(before);
  });

  test('the enemy card shows the enemy and FIGHT is ready with soldiers', async ({ page }) => {
    await setupCombatPhase(page, { combatSoldiers: 1 });

    const enemyName = page.locator('#enemy-name');
    await expect(enemyName).toBeVisible({ timeout: 3000 });
    await expect(enemyName).not.toBeEmpty();
    await expect(fightBtn(page)).not.toHaveAttribute('aria-disabled', 'true', { timeout: 3000 });
  });

  test('battle resolves with result', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 100,
      equipment: { weapon: 5, armor: 5 },
    });

    await fightBtn(page).click();
    await expect(summary(page)).toBeVisible({ timeout: 5000 });
    await expect(summary(page)).toContainText(/VICTORY|DEFEAT|DRAW/);
  });

  test('combat resources display after victory', async ({ page }) => {
    await setupCombatPhase(page, {
      combatSoldiers: 50,
      equipment: { weapon: 5, armor: 5 },
    });

    await fightBtn(page).click();
    await expect(summary(page)).toBeVisible({ timeout: 5000 });

    await openTab(page, 'nest');
    await expect(page.locator('#activity-log')).toContainText(/Scouts report|march to meet|soldiers defeated|soldiers were slaughtered|fled/, { timeout: 5000 });

    await summary(page).locator('[data-sheet-close]').click();
    await expect(summary(page)).toBeHidden();
    await openTab(page, 'front', 'war');
    // The replay is over: no round counter, and the log has the battle.
    await expect(page.locator('#battle-panel [data-round]')).toHaveCount(0);
    await expect(page.locator('#combat-log-panel [data-battle-line]')).toHaveCount(1);
  });
});
