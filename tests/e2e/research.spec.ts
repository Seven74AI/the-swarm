import { test, expect } from '@playwright/test';

/**
 * Research System E2E Tests
 *
 * Covers: researcher assignment, project start, progress visualization,
 * completion, and chain unlock.
 *
 * IMPORTANT: Seed data must include all required state fields.
 */

const BASE_GAME_STATE = {
  resources: {
    eggs: 0, larvae: 0, workers: 100, food: 1000, nestCapacity: 25,
    wood: 500, stone: 1000, nectar: 500, voidCrystals: 10, antimatter: 1, darkMatter: 0,
  },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  soldierPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
  soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
  buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 0 } },
  territory: { ownedTiles: 0, bonuses: {} },
  mapTiles: [],
  expeditions: [],
  spaceExplorations: [],
  discoveredPlanets: [],
  spaceships: [],
  upgrades: {} as Record<string, number>,
  stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 0 },
  unlockedPanels: [] as string[],
  lastSaveTimestamp: 0,
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
  research: {
    projects: {
      voidCrystalSynthesis: { state: 'available', progress: 0 },
      antimatterContainment: { state: 'locked', progress: 0 },
      darkMatterDetection: { state: 'locked', progress: 0 },
    },
  },
};

async function seedAndGoto(
  page: any,
  gameStateOverrides: Record<string, unknown>,
) {
  await page.addInitScript((saveStr: string) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify({
    version: 8,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: { ...BASE_GAME_STATE, ...gameStateOverrides },
  }));
  await page.goto('/');
  // Wait for bootstrap and DOM
  await page.waitForTimeout(1500);
}

test.describe('Research System', () => {
  test('research panel visible in expansion phase', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
    });

    // Research panel should be visible
    const panel = page.locator('#research-panel');
    await expect(panel).toBeVisible();

    // Should show the title
    await expect(panel).toContainText('Research');
  });

  test('research panel lists all 3 projects', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
    });

    // Check project names are visible
    const panel = page.locator('#research-panel');
    await expect(panel).toContainText('Void Crystal Synthesis');
    await expect(panel).toContainText('Antimatter Containment');
    await expect(panel).toContainText('Dark Matter Detection');
  });

  test('first project shows Available status', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
    });

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');
    await expect(vcsCard).toContainText('Available');
  });

  test('chained projects show Locked status', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
    });

    const panel = page.locator('#research-panel');
    const acCard = panel.locator('[data-research-project="antimatterContainment"]');
    await expect(acCard).toContainText('Locked');

    const dmdCard = panel.locator('[data-research-project="darkMatterDetection"]');
    await expect(dmdCard).toContainText('Locked');
  });

  test('assign researchers and start project', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
    });

    // Click '+' on researcher pool 50 times to assign researchers
    const panel = page.locator('#research-panel');
    const plusButtons = panel.locator('button');
    // Find the researchers + button (first one after "Researchers:" text)
    const researcherSection = panel.locator('.research-researcher-pool');
    const researcherPlus = researcherSection.locator('button').last();

    // Assign 50 researchers
    for (let i = 0; i < 50; i++) {
      await researcherPlus.click();
    }

    // After assignment, the Start button should be enabled
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');
    const startBtn = vcsCard.locator('button');
    await expect(startBtn).toBeEnabled();

    // Click Start
    await startBtn.click();

    // Project should now be in progress
    await expect(vcsCard).toContainText('In Progress');
  });

  test('progress bar appears for in-progress project', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
      workersAssigned: {
        gather: 0, tend: 0, dig: 0, guard: 0, researchers: 50,
      },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 30 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    // Wait a tick for state to settle
    await page.waitForTimeout(200);

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');

    // Should show in_progress status
    await expect(vcsCard).toContainText('In Progress');

    // Should have a progress bar
    const progressBar = vcsCard.locator('.progress-bar-fill, [role="progressbar"]');
    await expect(progressBar.first()).toBeVisible();

    // Should show progress text
    await expect(vcsCard).toContainText('ticks');
  });

  test('completed project shows unlock and Completed status', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
      workersAssigned: {
        gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0,
      },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'completed', progress: 120 },
          antimatterContainment: { state: 'available', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');

    // Should show Completed
    await expect(vcsCard).toContainText('Completed');

    // Should show unlock description
    await expect(vcsCard).toContainText('Unlocked');
    await expect(vcsCard).toContainText('voidCrystal');
  });

  test('cancel project shows Cancel button and clicking it works', async ({ page }) => {
    await seedAndGoto(page, {
      phase: 'expansion',
      workersAssigned: {
        gather: 0, tend: 0, dig: 0, guard: 0, researchers: 50,
      },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 30 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    // Wait for render
    await page.waitForTimeout(200);

    const panel = page.locator('#research-panel');
    const vcsCard = panel.locator('[data-research-project="voidCrystalSynthesis"]');

    // Should have a Cancel button
    await expect(vcsCard).toContainText('Cancel');

    // Click Cancel
    const cancelBtn = vcsCard.locator('button');
    await cancelBtn.click();

    // Project should be back to Available
    await expect(vcsCard).toContainText('Available');
  });
});
