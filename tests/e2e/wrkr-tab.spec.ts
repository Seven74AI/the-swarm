import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';
import { readResource } from './helpers/resources';
import { MS_PER_SEC } from '../../src/data/constants';
import { roleBalance } from '../../src/data/balance/roles';
import { skipGameTime } from './helpers/time';

/**
 * Story 1.23 (UX-DR15): WRKR. Role rows with a text bar, count and stepper
 * under one ×1 ×10 ×MAX row; the upkeep readout follows every change; the
 * primary action is the single most useful reallocation, or none.
 * No balance numbers here: assertions compare the page with itself.
 */

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 16, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Colony below its goal (no guards), so it never latches during the test. */
function colony(workers: number, food: number, assigned: Record<string, number> = {}) {
  return {
    phase: 'colony',
    resources: { eggs: 0, larvae: 0, workers, food, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0, ...assigned },
  };
}

const digits = (s: string | null): number => Number((s ?? '').replace(/\D/g, ''));

test.describe('WRKR tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('role rows have a hidden text bar, a count and a stepper under one multiplier row', async ({ page }) => {
    await seed(page, colony(8, 500, { gather: 3 }));
    await openTab(page, 'wrkr');
    const wrkr = page.locator('[data-tab-panel="wrkr"]');
    await expect(wrkr.locator('[data-upkeep]')).toHaveText(/UPKEEP \S+ \/ PRODUCTION \S+/);
    await expect(wrkr.locator('.stepper__multipliers')).toHaveCount(1);
    for (const role of ['gather', 'forage', 'tend', 'dig', 'guard']) {
      const row = wrkr.locator(`[data-role="${role}"]`);
      await expect(row).toBeVisible();
      await expect(row.locator('[data-role-bar]')).toHaveAttribute('aria-hidden', 'true');
      await expect(row.locator('[data-step="add"]')).toBeVisible();
    }
    await expect(wrkr.locator('[data-role="gather"] .role-count')).toHaveText('3');
    await expect(wrkr.locator('[data-role="gather"] [data-role-bar] [data-filled]')).toHaveText('███');
  });

  test('×MAX puts every free worker on a role, then [+] says no free workers', async ({ page }) => {
    await seed(page, colony(9, 500, { tend: 2 }));
    await openTab(page, 'wrkr');
    const wrkr = page.locator('[data-tab-panel="wrkr"]');
    const free = digits(await wrkr.locator('[data-free]').textContent());
    expect(free).toBeGreaterThan(0);
    const before = await wrkr.locator('[data-production-value]').textContent();
    await wrkr.locator('[data-multiplier="max"]').click();
    await wrkr.locator('[data-role="gather"] [data-step="add"]').click();
    await expect(wrkr.locator('[data-role="gather"] .role-count')).toHaveText(String(free));
    await expect(wrkr.locator('[data-free]')).toHaveText(/FREE 0$/);
    await expect(wrkr.locator('[data-role="dig"] [data-step="add"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(wrkr.locator('[data-role="dig"]')).toContainText('no free workers');
    await expect(wrkr.locator('[data-production-value]')).not.toHaveText(before ?? '');
  });

  test('a save from before Forage shows its row, and the roles alone bring in wood, stone and nectar (Story 3.4)', async ({ page }) => {
    // The seed has no `forage` (an old save) and no claimed territory.
    await seed(page, colony(10, 5000, { gather: 3, dig: 3 }));
    await openTab(page, 'wrkr');
    const wrkr = page.locator('[data-tab-panel="wrkr"]');
    await expect(wrkr.locator('[data-role="forage"] .role-count')).toHaveText('0');
    await wrkr.locator('[data-multiplier="max"]').click();
    await wrkr.locator('[data-role="forage"] [data-step="add"]').click();
    await expect(wrkr.locator('[data-free]')).toHaveText(/FREE 0$/);
    // Long enough for one worker on the slowest role to bring in a whole unit (read from the balance).
    const slowest = Math.min(roleBalance.gatherWoodPerSec, roleBalance.digStonePerSec, roleBalance.forageNectarPerSec);
    await skipGameTime(page, Math.ceil(MS_PER_SEC / slowest));
    for (const id of ['wood', 'stone', 'nectar']) {
      await expect.poll(() => readResource(page, id), { timeout: 10_000 }).toBeGreaterThan(0);
    }
  });

  test('when food runs out, the primary action moves workers to GATHER in one tap', async ({ page }) => {
    await seed(page, colony(30, 0, { tend: 24 }));
    await openTab(page, 'wrkr');
    const net = page.locator('[data-tab-panel="wrkr"] [data-net]');
    await expect(net).toHaveAttribute('data-trend', 'down');
    await expect(net).toContainText('▼');
    const primary = page.locator('[data-primary-for="wrkr"] [data-action="reallocate"]');
    await expect(primary).toBeVisible();
    await expect(primary.locator('[data-verb]')).toHaveText('MOVE');
    await expect(primary.locator('[data-target]')).toHaveText(/^\d+ TO GATHER$/);
    const gather = digits(await page.locator('[data-role="gather"] .role-count').textContent());
    await primary.click();
    await expect.poll(async () => digits(await page.locator('[data-role="gather"] .role-count').textContent())).toBeGreaterThan(gather);
  });

  test('with nothing critical there is no primary action', async ({ page }) => {
    await seed(page, colony(6, 5000, { gather: 6 }));
    await openTab(page, 'wrkr');
    await expect(page.locator('[data-tab-panel="wrkr"] [data-role="gather"]')).toBeVisible();
    await expect(page.locator('[data-action="reallocate"]')).toHaveCount(0);
  });
});
