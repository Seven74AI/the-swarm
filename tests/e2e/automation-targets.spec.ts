import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';
import { skipGameTime } from './helpers/time';
import { automationBalance } from '../../src/data/balance/automation';
import { HOUR_MS } from '../../src/data/constants';

/**
 * Story 4.10 (FR16, UX-DR16): once a verb has been done by hand N times (or
 * the next phase is reached), its automation target row appears under it:
 * `KEEP [−] N [+] IN TRAINING` with `[AUTO]`. With AUTO on the colony works
 * toward the target, live and offline, and the row says how it is doing.
 * Invariants only: counts against the target, never balance numbers.
 */

const N = automationBalance.targets.unlockAfterManual;

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'done');
  }, JSON.stringify({ version: 27, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Combat, below its goal and fed, with free workers to train. */
function combat(over: Record<string, unknown> = {}) {
  return {
    phase: 'combat',
    resources: { eggs: 0, larvae: 0, workers: 40, food: 50_000, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 8, forage: 0, tend: 0, dig: 0, guard: 2, researchers: 0 },
    nextEnemy: 'beetle',
    ...over,
  };
}

type State = { combatSoldiers: number; soldierPipeline: { count: number }; automation: { performed: { train: number } } };
const state = (page: Page) => page.evaluate(() => (window as unknown as { __swarm: { manager: { getState(): State } } }).__swarm.manager.getState());
const army = async (page: Page) => {
  const s = await state(page);
  return s.combatSoldiers + s.soldierPipeline.count;
};
const war = (page: Page) => page.locator('[data-segment-panel="war"]');

test.describe('automation target rows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('the training row appears after N manual trainings, not before', async ({ page }) => {
    await seed(page, combat());
    await openTab(page, 'front', 'war');
    const train = war(page).locator('[data-action="train-soldier"]');
    const row = war(page).locator('[data-automation="train"]');
    for (let i = 0; i < N - 1; i++) await train.click();
    await expect.poll(async () => (await state(page)).automation.performed.train).toBe(N - 1);
    await expect(row).toHaveCount(0);
    await train.click();
    await expect(row).toBeVisible();
    await expect(row).toContainText('KEEP');
    await expect(row).toContainText('IN TRAINING');
    await expect(row.getByRole('button', { name: 'AUTO' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('with AUTO on, the army is kept at the target and the row says holding at N', async ({ page }) => {
    await seed(page, combat({ automation: { performed: { train: N } } }));
    await openTab(page, 'front', 'war');
    const row = war(page).locator('[data-automation="train"]');
    await row.scrollIntoViewIfNeeded();
    const target = Number(await row.locator('[data-stepper-value]').textContent());
    await row.locator('[data-step="add"]').click();
    await expect(row.locator('[data-stepper-value]')).toHaveText(String(target + 1));
    await row.getByRole('button', { name: 'AUTO' }).click();
    await expect(row.getByRole('button', { name: 'AUTO' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => army(page)).toBe(target + 1);
    await expect(row.locator('[data-automation-status="holding"]')).toContainText(`holding at ${target + 1}`);
  });

  test('a colony with no free worker holds and says why, in warn', async ({ page }) => {
    await seed(page, combat({
      workersAssigned: { gather: 30, forage: 0, tend: 0, dig: 0, guard: 10, researchers: 0 },
      automation: { performed: { train: N }, targets: { train: { target: 20, on: true } } },
    }));
    await openTab(page, 'front', 'war');
    const status = war(page).locator('[data-automation="train"] [data-automation-status]');
    await expect(status).toHaveAttribute('data-automation-status', 'blocked');
    await expect(status).toHaveAttribute('data-warn', '');
    await expect(status).toContainText('no free workers');
  });

  test('offline runs the same target: after an absence the army is at the target', async ({ page }) => {
    await seed(page, combat({ automation: { performed: { train: N }, targets: { train: { target: 12, on: true } } } }));
    await skipGameTime(page, HOUR_MS);
    await expect.poll(() => army(page)).toBe(12);
  });

  test('laying: the row sits under the queen, and the queen lays on her own toward it', async ({ page }) => {
    await seed(page, combat({ automation: { targets: { lay: { target: 30, on: true } } } }));
    const row = page.locator('[data-nest-scene] [data-automation="lay"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('IN THE BROOD');
    const laid = () => page.evaluate(() => (window as unknown as { __swarm: { manager: { getState(): { stats: { totalEggsLaid: number; totalClicks: number } } } } }).__swarm.manager.getState().stats);
    const before = await laid();
    await skipGameTime(page, HOUR_MS);
    const after = await laid();
    expect(after.totalEggsLaid).toBeGreaterThan(before.totalEggsLaid);
    expect(after.totalClicks).toBe(before.totalClicks);
  });
});
