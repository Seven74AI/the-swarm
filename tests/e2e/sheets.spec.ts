import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: one sheet at a time (Story 1.14, AR10, UX-DR22).
 *
 * A save that is old enough for the offline summary and has a decision event
 * open (Story 1.28: it is in the save) requests both sheets at boot. The offline summary
 * (higher priority) opens first; the decision sheet waits and opens when it closes.
 * The modal sheets are dialogs that take focus and keep it, a dismissible one closes
 * with Esc, and a decision sheet does not.
 *
 * The seed is a partial save: SaveManager.load() migrates and deep-merges it.
 */

function emptyMapTiles() {
  const tiles: Array<{ x: number; y: number; type: string; discovered: boolean; claimed: boolean }> = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) tiles.push({ x, y, type: 'empty', discovered: false, claimed: false });
  return tiles;
}

const OPEN_MS = 40_000;

async function seedBoth(page: Page): Promise<void> {
  const away = Date.now() - 120_000;
  const playTimeMs = 200_000;
  const save = {
    version: 12,
    timestamp: away,
    playTimeMs,
    gameState: {
      phase: 'egg_laying',
      resources: {
        eggs: 20, larvae: 10, workers: 5, food: 200, nestCapacity: 50,
        wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0, surveyData: 0,
      },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      soldierPipeline: { count: 0, progress: 0 },
      workersAssigned: { gather: 3, tend: 1, dig: 1, guard: 0, researchers: 0 },
      soldiers: { scouts: 0, warriors: 0, totalKilled: 0 },
      buildings: { barracks: { level: 0, count: 0 }, walls: { level: 0 }, warehouse: { level: 0 } },
      territory: { ownedTiles: 0, bonuses: {} },
      mapTiles: emptyMapTiles(),
      expeditions: [],
      spaceExplorations: [],
      discoveredPlanets: [],
      spaceships: [],
      upgrades: {},
      stats: { totalEggsLaid: 20, totalClicks: 10, playTimeMs },
      unlockedPanels: ['resource_panel', 'phase_indicator', 'click_button'],
      lastSaveTimestamp: away,
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
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 0 },
      offlineEfficiency: 0.5,
      conversions: { particleLab: 0 },
      entropy: 0,
      entropyDampener: { level: 0 },
      prestigeTree: { purchased: [] },
      decision: {
        open: { id: 'overcrowding', remainingMs: OPEN_MS, openedAtSessionMs: 0, roll: 0.5 },
        nextSpawnSessionMs: 0,
      },
    },
  };
  await page.addInitScript((s: string) => localStorage.setItem('the_swarm_save', s), JSON.stringify(save));
  await page.goto('/');
}

const offline = (page: Page) => page.locator('.offline-summary-popup');
const decision = (page: Page) => page.locator('#decision-popup');

test.describe('Sheets (Story 1.14)', () => {
  test('the offline summary opens first; the decision sheet waits, then opens after it', async ({ page }) => {
    await seedBoth(page);
    await expect(offline(page)).toBeVisible({ timeout: 10_000 });
    // Give the first ticks time to raise the decision event: it must wait, not stack.
    await page.waitForTimeout(1500);
    await expect(decision(page)).toHaveCount(0);
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(1);

    // Its countdown waits too (Story 1.28): no time is lost behind the summary.
    const left = () =>
      page.evaluate(
        () =>
          (window as unknown as { __swarm: { manager: { getState(): { decision: { open: { remainingMs: number } | null } } } } }).__swarm.manager.getState()
            .decision.open?.remainingMs,
      );
    expect(await left()).toBe(OPEN_MS);

    await offline(page).locator('[data-sheet-close]').click();
    await expect(offline(page)).toHaveCount(0);
    await expect(decision(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(1);
    await expect.poll(left, { timeout: 5_000 }).toBeLessThan(OPEN_MS);
  });

  test('a modal sheet takes focus on its headline, keeps Tab inside, and closes with Esc', async ({ page }) => {
    await seedBoth(page);
    await expect(offline(page)).toBeVisible({ timeout: 10_000 });
    await expect(offline(page).locator('[data-sheet-headline]')).toBeFocused();

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      const inside = await offline(page).evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(offline(page)).toHaveCount(0);
    await expect(page.locator('.offline-overlay')).toHaveCount(0);
  });

  test('a decision sheet ignores Esc and closes only by a choice', async ({ page }) => {
    await seedBoth(page);
    await offline(page).locator('[data-sheet-close]').click({ timeout: 10_000 });
    await expect(decision(page)).toBeVisible({ timeout: 10_000 });
    await expect(decision(page).locator('[data-sheet-headline]')).toBeFocused();
    await expect(decision(page).locator('[data-sheet-close]')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(decision(page)).toBeVisible();

    await decision(page).locator('button[data-choice]').first().click();
    await expect(decision(page)).toHaveCount(0);
  });

  test('a dismissible sheet closes by a swipe down and by a scrim tap', async ({ page }) => {
    await seedBoth(page);
    const headline = offline(page).locator('[data-sheet-headline]');
    await expect(headline).toBeVisible({ timeout: 10_000 });
    const box = (await headline.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 150, { steps: 6 });
    await page.mouse.up();
    await expect(offline(page)).toHaveCount(0);

    // The decision sheet that was waiting opens next; it is not dismissible, so reload for a fresh offline sheet.
    await page.reload();
    await expect(offline(page)).toBeVisible({ timeout: 10_000 });
    await page.mouse.click(5, 5);
    await expect(offline(page)).toHaveCount(0);
  });
});
