import { test, expect } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Research System E2E Tests
 *
 * Seeds a colony in SPACE phase and verifies BUILD's research cards (Story 1.24):
 * researchers assigned on WRKR, START, the progress meter and time left,
 * completion, the chain unlock, and CANCEL (50 % BACK) through HoldToConfirm.
 *
 * Pattern: use page.clock.install() before goto, then advance time to trigger
 * phase transitions and panel rendering. Adapted from space-phase tests.
 */

function makeSaveData(overrides?: Record<string, unknown>) {
  return {
    version: 11,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'space',
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
      nextIds: { expedition: 1, exploration: 1, spaceship: 1 },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
      autoProduction: {
        enabled: false,
        researches: {},
        buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 },
        progress: 0,
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

async function seedSpaceAndWait(page: any, overrides?: Record<string, unknown>) {
  const data = makeSaveData(overrides);
  await page.addInitScript((saveStr: string) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(data));
  await page.clock.install();
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10000 });
  // The seed is already in SPACE, so the research panel is revealed on boot.
  // Wait for it instead of fast-forwarding a fixed span: every fake timer that
  // runFor() fires costs a real macrotask, which is slow under CI load.
  // Research lives in BUILD (Story 1.15).
  await openTab(page, 'build');
  await expect(page.locator('#research-panel')).toBeVisible({ timeout: 10000 });
}

test.describe('Research System', () => {
  const card = (page: any, id: string) => page.locator(`#research-panel [data-research-project="${id}"]`);

  test('research cards visible in space phase, one per chain step', async ({ page }) => {
    await seedSpaceAndWait(page);

    const panel = page.locator('#research-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel).toContainText('VOID CRYSTAL SYNTHESIS');
    await expect(panel).toContainText('ANTIMATTER CONTAINMENT');
    await expect(panel).toContainText('DARK MATTER DETECTION');
    await expect(panel.locator('[data-research-project] [data-card]')).toHaveCount(3);
  });

  test('the first step is available, the chained steps are locked', async ({ page }) => {
    await seedSpaceAndWait(page);

    await expect(card(page, 'voidCrystalSynthesis')).toHaveAttribute('data-research-status', 'available');
    await expect(card(page, 'antimatterContainment')).toHaveAttribute('data-research-status', 'locked');
    await expect(card(page, 'darkMatterDetection')).toHaveAttribute('data-research-status', 'locked');
    // A locked step names what it waits for.
    await expect(card(page, 'antimatterContainment')).toContainText('NEEDS VOID CRYSTAL SYNTHESIS');
  });

  test('assign researchers on WRKR, then START runs the step with a meter and the time left', async ({ page }) => {
    await seedSpaceAndWait(page);

    const start = card(page, 'voidCrystalSynthesis').locator('[data-action="start-research"]');
    await expect(start).toHaveAttribute('aria-disabled', 'true');
    await expect(card(page, 'voidCrystalSynthesis')).toContainText('RESEARCHERS');

    // Researchers are a WRKR role (Story 1.23): ×MAX puts every free worker on Research.
    await openTab(page, 'wrkr');
    const wrkr = page.locator('[data-tab-panel="wrkr"]');
    await wrkr.locator('[data-multiplier="max"]').click();
    await wrkr.locator('[data-role="research"] [data-step="add"]').click();

    await openTab(page, 'build');
    await expect(start).not.toHaveAttribute('aria-disabled', 'true');
    await start.click();

    await expect(card(page, 'voidCrystalSynthesis')).toHaveAttribute('data-research-status', 'in_progress');
    await expect(card(page, 'voidCrystalSynthesis').locator('[role="progressbar"]')).toHaveCount(1);
    await expect(card(page, 'voidCrystalSynthesis').locator('[data-time-left]')).toContainText('LEFT');
  });

  test('a completed step reads DONE and unlocks the next', async ({ page }) => {
    await seedSpaceAndWait(page, {
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'completed', progress: 600 },
          antimatterContainment: { state: 'available', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    await expect(card(page, 'voidCrystalSynthesis')).toHaveAttribute('data-research-status', 'completed');
    await expect(card(page, 'voidCrystalSynthesis')).toContainText('DONE');
    await expect(card(page, 'antimatterContainment')).toHaveAttribute('data-research-status', 'available');
    // The converter's first step is unlocked by it.
    await expect(page.locator('#resource-converter-panel [data-conversion="voidCrystalSynthesis"]')).toHaveAttribute('data-unlocked', 'true');
  });

  test('CANCEL (50 % BACK) shows the refund first, and holding it refunds half', async ({ page }) => {
    await seedSpaceAndWait(page, {
      workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 50 },
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'in_progress', progress: 30 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
    });

    const vcsCard = card(page, 'voidCrystalSynthesis');
    await expect(vcsCard).toHaveAttribute('data-research-status', 'in_progress');
    await expect(vcsCard.locator('[data-refund]')).toContainText('BACK');

    const read = () => page.evaluate(() => {
      // @ts-ignore - runs in browser context
      const s = window.__swarm.manager.getState();
      return { stone: s.resources.stone as number, nectar: s.resources.nectar as number };
    });
    const before = await read();

    // Cancel is irreversible: hold it past the hold duration (Story 1.13).
    const cancelBtn = vcsCard.locator('[data-action="cancel-research"]');
    await expect(cancelBtn).toHaveAttribute('aria-label', /CANCEL \(50 % BACK\)/);
    await cancelBtn.dispatchEvent('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
    // The hold completes and fires while still pressed; the control then leaves the card.
    await page.clock.runFor(1500);

    await expect(vcsCard).toHaveAttribute('data-research-status', 'available');
    const after = await read();
    expect(after.stone).toBeGreaterThan(before.stone);
    expect(after.nectar).toBeGreaterThan(before.nectar);
  });
});
