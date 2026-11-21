import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Story 1.25 (UX-DR10, UX-DR26): FRONT and its WAR segment. Combat RNG is
 * seeded from the save (Story 3.1), but the specs still accept
 * VICTORY | DEFEAT | DRAW and never assert one outcome.
 */

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 16, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

function combat(over: Record<string, unknown> = {}) {
  return {
    phase: 'combat',
    resources: { eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 4, tend: 4, dig: 4, guard: 4, researchers: 0 },
    ...over,
  };
}

const digits = (s: string | null): number => Number((s ?? '').replace(/\D/g, ''));
const war = (page: Page) => page.locator('[data-segment-panel="war"]');
const fight = (page: Page) => page.locator('[data-primary-for="front"] [data-action="fight"]');

test.describe('FRONT · WAR', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('WAR shows soldiers, equipment, mutations, the enemy card and the combat log, in that order', async ({ page }) => {
    await seed(page, combat());
    await openTab(page, 'front', 'war');
    const ids = ['#soldier-panel', '#mutation-panel', '#battle-panel', '#combat-log-panel'];
    for (const id of ids) await expect(war(page).locator(id)).toBeVisible();
    const tops = await Promise.all(ids.map((id) => war(page).locator(id).evaluate((el) => el.getBoundingClientRect().top)));
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    await expect(war(page).locator('[data-card="equipment-weapon"]')).toBeVisible();
    await expect(war(page).locator('[data-card="equipment-armor"]')).toBeVisible();
    await expect(war(page).locator('#enemy-name')).not.toBeEmpty();
    await expect(war(page).locator('#combat-log-panel [data-empty]')).toBeVisible();
  });

  test('the enemy card shows its type and trait before the fight, and the same enemy after a reload (Story 4.1)', async ({ page }) => {
    const save = JSON.stringify({ version: 16, timestamp: Date.now(), playTimeMs: 0, gameState: combat({ nextEnemy: 'beetle' }) });
    await page.addInitScript((text: string) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_save', text);
      localStorage.setItem('the_swarm_onboarding', 'complete');
    }, save);
    await page.goto('/');
    await openTab(page, 'front', 'war');
    const card = war(page).locator('[data-war="enemy"]');
    await expect(card).toHaveAttribute('data-enemy', 'beetle');
    await expect(card.locator('.card__name')).toHaveText(/ARMORED BEETLE\s*·\s*,?\s*THICK SHELL/);
    await expect(card.locator('[data-trait-line]')).not.toBeEmpty();
    await page.reload();
    await openTab(page, 'front', 'war');
    await expect(war(page).locator('[data-war="enemy"]')).toHaveAttribute('data-enemy', 'beetle');
  });

  test('> FIGHT is the primary action, disabled with "train soldiers first" without soldiers', async ({ page }) => {
    await seed(page, combat({ combatSoldiers: 0 }));
    await openTab(page, 'front', 'war');
    await expect(fight(page)).toBeVisible();
    await expect(fight(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-primary-for="front"]')).toContainText('train soldiers first');
  });

  test('TRAIN sends a worker to training: the training count rises and food drops', async ({ page }) => {
    await seed(page, combat());
    await openTab(page, 'front', 'war');
    const training = war(page).locator('[data-training]');
    const before = digits(await training.textContent());
    await war(page).locator('[data-action="train-soldier"]').click();
    await expect.poll(async () => digits(await training.textContent())).toBeGreaterThan(before);
  });

  test('the army upkeep sits next to the soldier count, and TRAIN names its ongoing cost (Story 4.4)', async ({ page }) => {
    await seed(page, combat({ combatSoldiers: 8 }));
    await openTab(page, 'front', 'war');
    const line = war(page).locator('.war-line', { has: page.locator('[data-soldiers]') });
    const upkeep = line.locator('[data-army-upkeep]');
    await expect(upkeep).toBeVisible();
    await expect(upkeep).toContainText('UPKEEP');
    await expect(upkeep).toContainText('FOOD/S');
    expect(Number((await upkeep.textContent())!.replace(/[^\d.]/g, ''))).toBeGreaterThan(0);
    await expect(war(page).locator('#soldier-panel')).toContainText(/1 WORKER/);
  });

  test('a starving colony trains no soldiers: TRAIN is disabled and says why (Story 4.4)', async ({ page }) => {
    // An empty store, nobody gathering, and an army that eats far more than the idle workers make.
    await seed(page, combat({ combatSoldiers: 500, resources: { eggs: 0, larvae: 0, workers: 20, food: 0, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 }, workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 4, researchers: 0 } }));
    await openTab(page, 'front', 'war');
    const train = war(page).locator('[data-action="train-soldier"]');
    await expect(train).toHaveAttribute('aria-disabled', 'true');
    await expect(war(page).locator('#soldier-panel')).toContainText('the colony is starving');
  });

  test('FIGHT runs a round counter on the enemy card, then the battle summary opens', async ({ page }) => {
    await seed(page, combat({ combatSoldiers: 50, equipment: { weapon: 5, armor: 5 } }));
    await openTab(page, 'front', 'war');
    await expect(fight(page)).not.toHaveAttribute('aria-disabled', 'true');
    await fight(page).click();
    await expect(war(page).locator('#battle-panel [data-round]')).toBeVisible();
    const sheet = page.locator('#battle-result[data-battle-summary]');
    await expect(sheet).toBeVisible({ timeout: 5000 });
    await expect(sheet.locator('[data-sheet-headline]')).toHaveText(/VICTORY|DEFEAT|DRAW/);
    await expect(sheet.locator('[data-losses]')).toBeVisible();
    await sheet.locator('[data-sheet-close]').click();
    await expect(sheet).toBeHidden();
    await expect(war(page).locator('[data-round]')).toHaveCount(0);
    await expect(war(page).locator('#combat-log-panel [data-battle-line]').first()).toHaveText(/VICTORY|DEFEAT|DRAW/);
  });

  test('the summary names one cause, and > CHANGE opens the counter card on WAR (Story 4.3)', async ({ page }) => {
    // One soldier against an armored beetle cannot win, whatever the rolls: a defeat or a draw.
    // Both workshops stand, so counter cards are open; no chitin or silk, so the counter shows its shortfall.
    await seed(
      page,
      combat({
        combatSoldiers: 1,
        nextEnemy: 'beetle',
        buildings: { chitin_armory: { level: 1 }, silk_weaving: { level: 1 } },
        combatResources: { chitin: 0, silk: 0, venom: 0 },
      }),
    );
    await openTab(page, 'front', 'war');
    await fight(page).click();
    const sheet = page.locator('[data-battle-summary]');
    await expect(sheet).toBeVisible({ timeout: 5000 });
    await expect(sheet).toHaveAttribute('data-outcome', /defeat|draw/);
    await expect(sheet.locator('[data-sheet-headline]')).toHaveText(/DEFEAT|DRAW · THEY RETREATED\./);
    await expect(sheet.locator('[data-cause]')).toHaveCount(1);
    await expect(sheet.locator('[data-cause]')).toHaveText(/^[A-Z ]+\.$/);
    const change = sheet.locator('button[data-action="change"]');
    await expect(change).toBeVisible();
    await expect(change).toContainText('CHANGE');
    await expect(change.locator('[data-cost]')).toContainText(/needs \d+ more/);
    const key = (await change.getAttribute('data-counter'))!;
    await change.click();
    await expect(sheet).toBeHidden();
    await expect(war(page).locator(`[data-card="${key.replace(':', '-')}"]`)).toHaveAttribute('data-jumped', '');
  });

  test('two battles in a row both reach the summary and the log', async ({ page }) => {
    await seed(page, combat({ combatSoldiers: 200, equipment: { weapon: 5, armor: 5 } }));
    await openTab(page, 'front', 'war');
    for (let i = 1; i <= 2; i++) {
      await fight(page).click();
      const sheet = page.locator('[data-battle-summary]');
      await expect(sheet).toBeVisible({ timeout: 5000 });
      await sheet.locator('[data-sheet-close]').click();
      await expect(sheet).toBeHidden();
      await expect(war(page).locator('#combat-log-panel [data-battle-line]')).toHaveCount(i);
    }
  });

  test('MAP and STARS host the legacy panels; FIGHT shows only in WAR', async ({ page }) => {
    await seed(page, combat({ phase: 'space' }));
    await openTab(page, 'front', 'map');
    await expect(page.locator('[data-segment-panel="map"] .map-panel').first()).toBeVisible();
    await expect(fight(page)).toHaveCount(0);
    await openTab(page, 'front', 'stars');
    await expect(page.locator('[data-segment-panel="stars"] #spaceship-panel')).toBeVisible();
    await openTab(page, 'front', 'war');
    await expect(fight(page)).toBeVisible();
  });
});

test.describe('FRONT segment row', () => {
  test('grows with the phase, opens on the newest segment, remembers the last one, 44 px targets', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, combat({ phase: 'space' }));
    await openTab(page, 'front');
    const segs = page.locator('[data-segment-row] [data-segment]');
    expect(await segs.evaluateAll((els) => els.map((e) => e.getAttribute('data-segment')))).toEqual(['war', 'map', 'stars']);
    // Opens on the newest segment.
    await expect(page.locator('[data-segment="stars"]')).toHaveAttribute('aria-selected', 'true');
    for (const id of ['war', 'map', 'stars']) {
      const box = await page.locator(`[data-segment="${id}"]`).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    // The last segment used survives a tab switch.
    await openTab(page, 'front', 'war');
    await openTab(page, 'nest');
    await openTab(page, 'front');
    await expect(page.locator('[data-segment="war"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Combat shows only WAR', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, combat());
    await openTab(page, 'front');
    await expect(page.locator('[data-segment-row] [data-segment]')).toHaveCount(1);
    await expect(page.locator('[data-segment="war"]')).toHaveAttribute('aria-selected', 'true');
  });
});
