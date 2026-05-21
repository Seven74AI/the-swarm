import { test, expect } from '@playwright/test';

/**
 * Research System E2E Tests
 *
 * Seeds a colony in EXPANSION phase and verifies the research panel,
 * researcher assignment, project start, progress, completion, and chain unlock.
 *
 * Pattern: use page.clock.install() before goto, then advance time to trigger
 * phase transitions and panel rendering. Adapted from space-phase tests.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 7,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'expansion',
      resources: {
        eggs: 5, larvae: 3, workers: 100, food: 2100,
        nestCapacity: 100, wood: 500, stone: 1000, nectar: 500,
        voidCrystals: 10, antimatter: 1, darkMatter: 0,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
      buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 0 } },
      territory: { ownedTiles: 0, bonuses: {} },
      expeditions: [],
      upgrades: {},
      stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
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
      spaceship: { level: 0, fuel: 0, maxFuel: 100 },
      spaceProbes: [],
      discoveries: [],
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'available', progress: 0 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
      ...overrides,
    },
  };
}

async function seedExpansionAndWait(page: any, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr: string) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.clock.install();
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });
  // Advance time so the game processes ticks and renders panels
  await page.clock.runFor(2000);
}

test.describe('Research System', () => {
  test('research panel visible in expansion phase', async ({ page }) => {
    await seedExpansionAndWait(page);

    const panel = page.locator('#research-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel).toContainText('Research');
  });

  test('research panel lists all 3 projects', async ({ page }) => {
    await seedExpansionAndWait(page);

    const panel = page.locator('#research-panel');
    await expect(panel).toContainText('Void Crystal Synthesis');
    await expect(panel).toContainText('Antimatter Containment');
    await expect(panel).toContainText('Dark Matter Detection');
  });

  test('first project shows Available status', async ({ page }) => {
    await seedExpansionAndWait(page);

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');
    await expect(vcsCard).toContainText('Available');
  });

  test('chained projects show Locked status', async ({ page }) => {
    await seedExpansionAndWait(page);

    const panel = page.locator('#research-panel');
    const acCard = panel.locator('[data-research-project="antimatterContainment"]');
    await expect(acCard).toContainText('Locked');

    const dmdCard = panel.locator('[data-research-project="darkMatterDetection"]');
    await expect(dmdCard).toContainText('Locked');
  });

  test('assign researchers and start project', async ({ page }) => {
    await seedExpansionAndWait(page);

    // Click '+' on researcher pool 50 times to assign researchers
    const panel = page.locator('#research-panel');
    const researcherSection = panel.locator('.research-researcher-pool');
    const researcherPlus = researcherSection.locator('button').last();

    for (let i = 0; i < 50; i++) {
      await researcherPlus.dispatchEvent('click');
      await page.clock.runFor(50); // let state update
    }

    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');
    const startBtn = vcsCard.locator('button');
    await expect(startBtn).toBeEnabled();

    await startBtn.dispatchEvent('click');
    await page.clock.runFor(100);

    await expect(vcsCard).toContainText('In Progress');
  });

  test('progress bar appears for in-progress project', async ({ page }) => {
    await seedExpansionAndWait(page, {
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 50 },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 30 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    // Advance time to let signals settle
    await page.clock.runFor(500);

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');

    await expect(vcsCard).toContainText('In Progress');

    const progressBar = vcsCard.locator('.progress-bar-fill, [role="progressbar"]');
    // Progress bar exists (may use CSS visibility:hidden during animation)
    const barCount = await progressBar.count();
    expect(barCount).toBeGreaterThan(0);

    await expect(vcsCard).toContainText('ticks');
  });

  test('completed project shows unlock and Completed status', async ({ page }) => {
    await seedExpansionAndWait(page, {
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'completed', progress: 120 },
          antimatterContainment: { state: 'available', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    await page.clock.runFor(500);

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');

    await expect(vcsCard).toContainText('Completed');
    await expect(vcsCard).toContainText('Unlocked');
    await expect(vcsCard).toContainText('voidCrystal');
  });

  test('cancel project shows Cancel button and clicking it works', async ({ page }) => {
    await seedExpansionAndWait(page, {
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 50 },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 30 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    await page.clock.runFor(500);

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');

    await expect(vcsCard).toContainText('Cancel');

    const cancelBtn = vcsCard.locator('button');
    await cancelBtn.dispatchEvent('click');
    await page.clock.runFor(100);

    await expect(vcsCard).toContainText('Available');
  });
});
