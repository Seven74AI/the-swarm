import { test, expect, type Page } from '@playwright/test';

/** Story 9.11 (FR66, UX-DR50, FR27): the resource sheet says whether I'm okay, and the tap goes to the fix. */
const HUNGRY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 20, food: 800, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
  workersAssigned: { gather: 0, forage: 0, tend: 20, dig: 0, guard: 0, researchers: 0 },
};

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save) => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    localStorage.setItem('the_swarm_save', save);
  }, JSON.stringify({ version: 37, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('[data-resource-strip]')).toBeVisible();
}

test('the verdict says food is running out, and a tap opens WRKR on Gather; nothing opens on its own', async ({ page }) => {
  await seed(page, HUNGRY);
  await page.locator('[data-resource-strip]').click();
  const verdict = page.locator('[data-resource-sheet] [data-verdict]');
  await expect(verdict).toHaveAttribute('data-verdict', 'food');
  await expect(verdict).toHaveText(/^FOOD LASTS /);
  await expect(verdict).toHaveAttribute('data-warn', '');
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-tab', 'nest');
  await verdict.click();
  await expect(page.locator('[data-resource-sheet]')).toHaveCount(0);
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-tab', 'wrkr');
  await expect(page.locator('[data-role="gather"]')).toHaveAttribute('data-jumped', '');
});

test('the second opening says what changed since the first', async ({ page }) => {
  await seed(page, HUNGRY);
  const sheet = page.locator('[data-resource-sheet]');
  await page.locator('[data-resource-strip]').click();
  await expect(sheet.locator('[data-since]')).toHaveCount(0);
  await sheet.locator('[data-sheet-close]').click();
  await page.locator('[data-resource-strip]').click();
  await expect(sheet.locator('[data-since]')).toHaveText(/^FOOD [+−0].* SINCE \d{2}:\d{2}\W+NET WAS .+, NOW .+$/);
});

test('a full food store says so, and a tap opens NEST with its room jobs, where a Larder holds more (Story 9.17)', async ({ page }) => {
  await seed(page, {
    phase: 'colony',
    resources: { eggs: 0, larvae: 0, workers: 20, food: 1_000_000, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
    workersAssigned: { gather: 20, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
    dig: { roomsDug: 2, progress: 0, carry: 0, roomsByHand: 2, auto: false },
  });
  await page.locator('[data-resource-strip]').click();
  const verdict = page.locator('[data-resource-sheet] [data-verdict]');
  await expect(verdict).toHaveAttribute('data-verdict', 'limit');
  await expect(verdict.locator('[data-settles]')).toHaveCount(0);
  await expect(page.locator('[data-room-jobs-sheet]')).toHaveCount(0);
  await verdict.click();
  await expect(page.locator('[data-resource-sheet]')).toHaveCount(0);
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-tab', 'nest');
  await expect(page.locator('[data-room-jobs-sheet]')).toBeVisible();
});
