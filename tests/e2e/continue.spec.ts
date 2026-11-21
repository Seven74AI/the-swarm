import { test, expect, type Page } from '@playwright/test';
import { gameTimePasses } from './helpers/time';
import { openTab } from './helpers/tabs';
import { tapContinue } from './helpers/phase';

/**
 * Story 1.19 (FR18, UX-DR13, UX-DR14): the phase changes only when the player
 * taps CONTINUE. A met goal latches: NEST gets `•`, its primary action becomes
 * `> CONTINUE`, and the goal stays met through dips and reloads.
 * Numbers are never asserted against balance values: they come from the save.
 */

async function seed(page: Page, version: number, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    // Seed once: a reload must load what the game saved, not this seed again.
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

const phaseOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __swarm: { manager: { getState(): { phase: string } } } }).__swarm.manager.getState().phase);

/** Colony whose goal latched earlier, with the workers since dipped well below it. */
const DIPPED_COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 3, food: 5000, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
  workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 1, researchers: 0 },
  stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 120_000 },
  phaseGoal: { phase: 'combat', latched: true, atMs: 60_000, reached: { workers: 999, guard: 1 } },
};

test.describe('CONTINUE', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('a met goal waits for CONTINUE instead of changing the phase', async ({ page }) => {
    // A v14 save whose Egg Laying goal is already met: the migration latches it.
    await seed(page, 14, { phase: 'egg_laying', resources: { workers: 1_000, food: 500, nestCapacity: 2_000 } });
    const cont = page.locator('[data-action="continue"]');
    await expect(cont).toBeVisible();
    await expect(cont).toContainText('CONTINUE');
    // Several ticks later the phase still has not moved, and the egg button gave way to CONTINUE.
    await gameTimePasses(page, 500);
    expect(await phaseOf(page)).toBe('egg_laying');
    await expect(page.locator('#click-egg')).toBeHidden();
    await expect(page.locator('[data-goal-meter="full"] [data-goal-next]')).toHaveText(/^GOAL MET/);

    await tapContinue(page);
    expect(await phaseOf(page)).toBe('colony');
    await expect(page.locator('#phase-indicator [data-phase-name]')).toContainText('The Colony');
  });

  test('NEST gets • while the goal is met and another tab is open', async ({ page }) => {
    await seed(page, 15, DIPPED_COLONY);
    await openTab(page, 'wrkr');
    await expect(page.locator('[data-tab="nest"] [data-tab-dot]')).toBeVisible();
    await openTab(page, 'nest');
    await expect(page.locator('[data-tab="nest"] [data-tab-dot]')).toHaveCount(0);
  });

  test('a latched goal that dipped still reads GOAL MET, explains the dip, survives a reload and commits', async ({ page }) => {
    await seed(page, 15, DIPPED_COLONY);
    const meter = page.locator('#phase-indicator [data-goal-meter="full"]');
    const row = meter.locator('[data-condition="workers"]');
    const check = async () => {
      await expect(meter.locator('[data-goal-next]')).toHaveText(/^GOAL MET/);
      await expect(row).toHaveAttribute('data-dipped', 'true');
      await expect(row).toHaveAttribute('data-met', 'true');
      await expect(row).toContainText(/now, reached 999 at /);
      await expect(page.locator('[data-action="continue"]')).toBeVisible();
    };
    await check();

    // Save and reload: the latch is in the save.
    await page.evaluate(() => {
      const swarm = (window as unknown as { __swarm: { saveManager: { save(s: unknown, t: number, force: boolean): void }; manager: { getState(): { stats: { playTimeMs: number } } } } }).__swarm;
      const s = swarm.manager.getState();
      swarm.saveManager.save(s, s.stats.playTimeMs, true);
    });
    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();
    await check();

    await tapContinue(page);
    expect(await phaseOf(page)).toBe('combat');
    await expect(page.locator('[data-action="continue"]')).toHaveCount(0);
  });
});
