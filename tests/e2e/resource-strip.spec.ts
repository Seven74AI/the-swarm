/**
 * Story 1.16 (UX-DR7, UX-DR8): the resource strip at the top of the shell and the
 * resource sheet it opens. Replaces the ResourcePanel HUD spec.
 */
import { test, expect, type Page } from '@playwright/test';

/** Helper: build a minimal game state with a specific phase */
function makeGameState(phase: string) {
  const tiles = [];
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      tiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
    }
  }
  return {
    phase,
    resources: {
      eggs: 5000, larvae: 2000, workers: 500, food: 10000,
      nestCapacity: 1000, wood: 0, stone: 0, nectar: 0,
      voidCrystals: 100, antimatter: 50, darkMatter: 25,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    soldierPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 10, tend: 5, dig: 2, guard: 3, researchers: 0 },
    soldiers: { scouts: 10, warriors: 5, totalKilled: 0 },
    buildings: { barracks: { level: 1, count: 1 }, walls: { level: 1 }, warehouse: { level: 1 } },
    territory: { ownedTiles: 0, bonuses: {} },
    mapTiles: tiles,
    expeditions: [] as Array<Record<string, unknown>>,
    spaceExplorations: [] as Array<Record<string, unknown>>,
    discoveredPlanets: [] as string[],
    spaceships: [] as Array<Record<string, unknown>>,
    upgrades: {} as Record<string, number>,
    stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
    unlockedPanels: ['resource_panel', 'click_button', 'event_log', 'phase_indicator'],
    lastSaveTimestamp: 0,
    combatSoldiers: 0,
    soldierStats: { strength: 1, defense: 1, speed: 5, maxHp: 10 },
    equipment: { weapon: 0, armor: 0 },
    lastBattle: null,
    combatResources: { chitin: 0, silk: 0, venom: 0 },
    battlesWon: 0,
    battlesLost: 0,
    victoryAchieved: false,
    spaceship: { level: 0, fuel: 0, maxFuel: 100 },
    spaceProbes: [] as Array<Record<string, unknown>>,
    discoveries: [] as string[],
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
  };
}

async function seed(page: Page, phase: string): Promise<void> {
  const saveData = { version: 11, timestamp: Date.now(), playTimeMs: 0, gameState: makeGameState(phase) };
  await page.addInitScript((dataStr) => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    localStorage.setItem('the_swarm_save', dataStr);
  }, JSON.stringify(saveData));
}

const strip = (page: Page) => page.locator('[data-resource-strip]');
const cellIds = (page: Page) =>
  strip(page).locator('[data-strip-cell]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.stripCell));

test.describe('resource strip', () => {
  test('sits at the top of the shell with the Phase 1 cells', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('the_swarm_onboarding', 'done'));
    await page.goto('/');
    await expect(strip(page)).toBeVisible();
    expect(await cellIds(page)).toEqual(['eggs', 'larvae', 'workers', 'food']);
    // Inside the shell's strip slot, above the scroll area.
    await expect(page.locator('[data-shell-strip] [data-resource-strip]')).toHaveCount(1);
    for (const label of await strip(page).locator('[data-label]').allTextContents()) {
      expect(label).toMatch(/^[A-Z]{1,4}$/);
    }
    for (const v of await strip(page).locator('[data-value]').allTextContents()) {
      expect(v.length).toBeLessThanOrEqual(5);
    }
    await expect(strip(page)).not.toContainText('/s');
  });

  test('fits a 360 px wide screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, 'colony');
    await page.goto('/');
    await expect(strip(page)).toBeVisible();
    expect(await cellIds(page)).toEqual(['food', 'workers', 'wood', 'stone', 'nectar']);
    const overflow = await strip(page).evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await strip(page).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
  });

  test('a tap opens the resource sheet, which lists the unlocked resources and ends with SETTINGS', async ({ page }) => {
    await seed(page, 'space');
    await page.goto('/');
    await strip(page).click();
    const sheet = page.locator('[data-resource-sheet]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-resource-row="voidCrystals"] [data-col="name"]')).toHaveText('Void crystals');
    await expect(sheet.locator('[data-resource-row="eggs"] [data-col="amount"]')).toHaveText(/\d/);
    await expect(sheet.locator('[data-resource-header]')).toContainText('/s');
    await expect(sheet.locator('[data-action="settings"]')).toContainText('SETTINGS');
    await sheet.locator('[data-sheet-close]').click();
    await expect(sheet).toHaveCount(0);
  });

  test('at a large text scale shows 3 cells plus a +2 cell', async ({ page }) => {
    await seed(page, 'colony');
    await page.goto('/');
    await expect(strip(page)).toHaveAttribute('data-compact', 'false');
    // The player raises the text size: the strip narrows.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '24px';
      window.dispatchEvent(new Event('resize'));
    });
    await expect(strip(page)).toHaveAttribute('data-compact', 'true');
    await expect(strip(page).locator('[data-strip-cell]')).toHaveCount(3);
    await expect(strip(page).locator('[data-strip-more]')).toContainText('+2');
  });
});
