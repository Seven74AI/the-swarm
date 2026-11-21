import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Story 1.18 (UX-DR13): NEST shows `NEXT: <conditions>` with one list item per
 * condition; every other tab shows the condensed one-line meter instead.
 * Numbers are never asserted here: they come from transitions.ts.
 */

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 14, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Colony with a few workers: below the goal, so it never transitions during the test. */
const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 3, food: 500, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
  workersAssigned: { gather: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
};

test.describe('Goal meter', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
  });

  test('NEST lists every condition of the next goal as met or not met', async ({ page }) => {
    await seed(page, COLONY);
    const meter = page.locator('#phase-indicator [data-goal-meter="full"]');
    await expect(meter).toBeVisible();
    await expect(meter.locator('[data-goal-next]')).toHaveText(/^NEXT: /);
    await expect(page.locator('#phase-indicator')).toContainText('The Colony');

    const items = meter.getByRole('list').getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(meter.locator('[data-condition="guard"]')).toHaveAttribute('data-met', 'false');
    await expect(meter.locator('[data-condition="guard"]')).toContainText('not met');
    await expect(meter.locator('[data-condition="guard"] [data-condition-value]')).toHaveText(/^\d[\d ]*\/\d[\d ]*$/);
    await expect(meter.getByRole('progressbar')).toBeVisible();
  });

  test('NEST never names the next phase', async ({ page }) => {
    await seed(page, COLONY);
    const text = (await page.locator('[data-goal-meter="full"]').textContent()) ?? '';
    expect(text.toLowerCase()).not.toContain('combat');
    expect(text.toLowerCase()).not.toContain('war');
  });

  test('other tabs show the condensed one-line meter, and NEST does not', async ({ page }) => {
    await seed(page, COLONY);
    const condensed = page.locator('[data-goal-meter="condensed"]');
    await expect(condensed).toBeHidden();
    await openTab(page, 'wrkr');
    await expect(condensed).toBeVisible();
    await expect(condensed).toHaveText(/^NEXT .*\d+%$/);
    await expect(page.locator('[data-goal-meter="full"]')).toBeHidden();
    const box = await condensed.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(32);
    await openTab(page, 'nest');
    await expect(condensed).toBeHidden();
  });

  test('a met condition turns its row to met', async ({ page }) => {
    await seed(page, { ...COLONY, resources: { ...COLONY.resources, workers: 10 } });
    const guard = page.locator('[data-condition="guard"]');
    await expect(guard).toHaveAttribute('data-met', 'false');
    await openTab(page, 'wrkr');
    // Assign guards through the real control until the condition reports met (its target lives in transitions.ts).
    const plus = page.locator('#worker-assignment [data-role="guard"] button', { hasText: '+' });
    for (let i = 0; i < 10 && (await guard.getAttribute('data-met')) !== 'true'; i++) {
      await plus.click();
    }
    await openTab(page, 'nest');
    await expect(guard).toHaveAttribute('data-met', 'true');
    await expect(guard).not.toContainText('not met');
  });
});
