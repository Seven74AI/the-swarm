import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Story 2.8 (FR21): offline efficiency grows from 50% to 100%. The run's
 * offline research is sold on BUILD from Colony; an old save that owned the
 * one-off offline upgrades keeps its efficiency through the migration.
 * Assertions compare the page with itself and with the state, never with
 * balance numbers.
 */

async function seed(page: Page, gameState: Record<string, unknown>, timestamp = Date.now()): Promise<void> {
  await page.addInitScript((save: string) => {
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 16, timestamp, playTimeMs: 0, gameState }));
}

/** Colony below its goal (no guards), so it never latches during the test. */
function colony(food: number) {
  return {
    phase: 'colony',
    resources: { eggs: 0, larvae: 0, workers: 6, food, nestCapacity: 1000, wood: 0, stone: 0, nectar: 0 },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 6, tend: 0, dig: 0, guard: 0, researchers: 0 },
  };
}

const researchStatus = (page: Page) =>
  page.evaluate(() => {
    // @ts-ignore - runs in browser context
    return window.__swarm.manager.getState().research.projects.dormantForaging.status as string;
  });

test.describe('offline efficiency (Story 2.8)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('Colony BUILD sells the offline research, and START runs it', async ({ page }) => {
    await seed(page, colony(1_000_000));
    await page.goto('/');
    await expect(page.locator('[data-shell]')).toBeVisible();
    await openTab(page, 'build');

    const card = page.locator('[data-build-host="offline-research"] [data-research-project="dormantForaging"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-research-status', 'available');
    await expect(card).toContainText('OFFLINE EFFICIENCY');
    // No researcher crew: the researcher row opens with the space chain.
    await expect(card).not.toContainText('RESEARCHERS');

    const start = card.locator('[data-action="start-research"]');
    await expect(start).not.toHaveAttribute('aria-disabled', 'true');
    await start.click();
    await expect.poll(() => researchStatus(page)).toBe('running');
    await expect(card).toHaveAttribute('data-research-status', 'in_progress');
  });

  test('a save that owned both old offline upgrades comes back at 100%', async ({ page }) => {
    // Away 2 minutes: the offline path, so the summary names the efficiency used.
    await seed(page, { ...colony(100), offlineEfficiency: 1, prestigeTree: { purchased: [] } }, Date.now() - 120_000);
    await page.goto('/');
    const popup = page.locator('.offline-summary-popup');
    await expect(popup).toBeVisible({ timeout: 10_000 });
    await expect(popup.locator('.offline-efficiency')).toContainText('100%');
    const state = await page.evaluate(() => {
      // @ts-ignore - runs in browser context
      const s = window.__swarm.manager.getState();
      return { purchased: s.prestigeTree.purchased as string[], research: s.research.projects.dormantForaging.status as string, stored: 'offlineEfficiency' in s };
    });
    expect(state.purchased).toEqual(expect.arrayContaining(['temporal_resonance', 'chrono_synchronization']));
    expect(state.research).toBe('done');
    expect(state.stored).toBe(false);
  });
});
