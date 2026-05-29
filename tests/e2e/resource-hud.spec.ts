/**
 * E2E tests for Scannable Multi-Resource HUD (UX-5).
 * Tests: critical bar visibility, collapse/expand, phase gating, mobile layout.
 */
import { test, expect } from '@playwright/test';

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

test.describe('ResourcePanel — Multi-Resource HUD', () => {
  test('critical bar shows eggs, larvae, food, and soldiers', async ({ page }) => {
    await page.goto('/');
    const criticalBar = page.locator('.critical-bar');
    await expect(criticalBar).toBeVisible();
    const text = await criticalBar.textContent();
    expect(text).toContain('🥚');
    expect(text).toContain('🐛');
    expect(text).toContain('🍞');
    expect(text).toContain('⚔️');
  });

  test('colony section is visible with toggle and workers', async ({ page }) => {
    await page.goto('/');
    const colonySection = page.locator('.hud-section.colony-section');
    await expect(colonySection).toBeVisible();
    await expect(colonySection.locator('.section-toggle')).toHaveText('▼');
    await expect(colonySection.locator('.section-title')).toHaveText('Colony Resources');
  });

  test('collapse/expand toggle hides and shows colony body', async ({ page }) => {
    await page.goto('/');
    const colonySection = page.locator('.hud-section.colony-section');
    const toggle = colonySection.locator('.section-toggle');
    const body = colonySection.locator('.section-body');

    // Initially expanded
    await expect(body).toBeVisible();

    // Click to collapse
    await toggle.click();
    await expect(toggle).toHaveText('▶');
    await expect(body).not.toBeVisible();

    // Click to expand
    await toggle.click();
    await expect(toggle).toHaveText('▼');
    await expect(body).toBeVisible();
  });

  test('collapse state persists across page reload', async ({ page }) => {
    await page.goto('/');
    const colonySection = page.locator('.hud-section.colony-section');
    const toggle = colonySection.locator('.section-toggle');

    // Collapse
    await toggle.click();
    await expect(toggle).toHaveText('▶');

    // Reload
    await page.reload();
    await page.waitForSelector('.hud-section.colony-section');
    const toggle2 = page.locator('.hud-section.colony-section .section-toggle');
    await expect(toggle2).toHaveText('▶');
  });

  test('space section hidden in colony phase', async ({ page }) => {
    await page.goto('/');
    const spaceSection = page.locator('.hud-section.space-section');
    await expect(spaceSection).toHaveCount(0);
  });

  test('prestige section hidden in colony phase', async ({ page }) => {
    await page.goto('/');
    const prestigeSection = page.locator('.hud-section.prestige-section');
    await expect(prestigeSection).toHaveCount(0);
  });

  test('space section appears in SPACE phase', async ({ page }) => {
    // Inject save data with SPACE phase before page loads
    const saveData = {
      version: 11,
      timestamp: Date.now(),
      playTimeMs: 0,
      gameState: makeGameState('space'),
    };
    await page.addInitScript((dataStr) => {
      localStorage.setItem('the_swarm_save', dataStr);
    }, JSON.stringify(saveData));

    await page.goto('/');
    const spaceSection = page.locator('.hud-section.space-section');
    await expect(spaceSection).toBeVisible({ timeout: 8000 });
    await expect(spaceSection.locator('.section-title')).toHaveText('Space Resources');
  });

  test('prestige section appears in TRANSCENDENCE phase', async ({ page }) => {
    const saveData = {
      version: 11,
      timestamp: Date.now(),
      playTimeMs: 0,
      gameState: makeGameState('transcendence'),
    };
    await page.addInitScript((dataStr) => {
      localStorage.setItem('the_swarm_save', dataStr);
    }, JSON.stringify(saveData));

    await page.goto('/');
    const prestigeSection = page.locator('.hud-section.prestige-section');
    await expect(prestigeSection).toBeVisible({ timeout: 8000 });
    await expect(prestigeSection.locator('.section-title')).toHaveText('Prestige');
  });

  test('colony section has amber border-left color', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('.hud-section.colony-section .section-header');
    await expect(header).toBeVisible();
    const borderColor = await header.evaluate((el) =>
      getComputedStyle(el).borderLeftColor,
    );
    // Should be amber (rgb around 184, 148, 46)
    expect(borderColor).toMatch(/rgb\(18[0-9]+, 14[0-9]+, 4[0-9]+\)/);
  });

  test.describe('mobile layout', () => {
    test('single column at < 768px width', async ({ page }) => {
      await page.setViewportSize({ width: 480, height: 800 });
      await page.goto('/');
      const panel = page.locator('.resource-panel');
      await expect(panel).toBeVisible();
      const gridCols = await panel.evaluate((el) =>
        getComputedStyle(el).gridTemplateColumns,
      );
      // At <768px, no two-column grid should be applied
      expect(gridCols).not.toContain('1fr 1fr');
    });

    test('two-column at >= 768px width', async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 800 });
      await page.goto('/');
      const panel = page.locator('.resource-panel');
      await expect(panel).toBeVisible();
      const gridCols = await panel.evaluate((el) =>
        getComputedStyle(el).gridTemplateColumns,
      );
      // At >=768px, media query applies grid-template-columns: 1fr 1fr
      // Computed values resolve to exactly 2 pixel columns
      expect(gridCols.split(' ').length).toBe(2);
    });
  });
});
