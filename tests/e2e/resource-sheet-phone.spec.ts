import { test, expect, type Page } from '@playwright/test';

/**
 * Story 9.10 (FR66, UX-DR8, UX-DR4, NFR7, NFR9): the resource sheet reads on
 * a phone. Seeded in Space, where every resource is unlocked and the rows group.
 */
const SPACE = {
  phase: 'space',
  resources: { eggs: 120, larvae: 40, workers: 500, food: 50_000, nestCapacity: 500, wood: 3_000, stone: 2_000, nectar: 900, voidCrystals: 30, antimatter: 4, darkMatter: 1, surveyData: 2 },
  combatResources: { silk: 12, chitin: 40, venom: 3 },
};

/** Open every collapsed tier group, one at a time (each click changes which groups are closed). */
async function openAllGroups(page: Page): Promise<void> {
  const closed = page.locator('[data-resource-sheet] [data-resource-group][data-open="false"] [data-action="toggle-group"]');
  while ((await closed.count()) > 0) await closed.first().click();
}

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save) => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    localStorage.setItem('the_swarm_save', save);
  }, JSON.stringify({ version: 37, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await page.locator('[data-resource-strip]').click();
  await expect(page.locator('[data-resource-sheet]')).toBeVisible();
}

for (const size of [
  { width: 390, height: 844 },
  { width: 360, height: 512 },
]) {
  test.describe(`resource sheet on ${size.width}×${size.height} (Story 9.10)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
      await seed(page, SPACE);
    });

    test('two lines a resource, grouped by tier, no — anywhere, nothing sideways or overlapping', async ({ page }) => {
      const sheet = page.locator('[data-resource-sheet]');
      await expect(sheet.locator('[data-resource-group]')).not.toHaveCount(0);
      await expect(sheet).not.toContainText('—');
      // Open every group, so every row is laid out.
      await openAllGroups(page);
      const rows = sheet.locator('[data-resource-row]');
      const n = await rows.count();
      expect(n).toBeGreaterThan(8);
      const boxes = [];
      for (let i = 0; i < n; i++) {
        const row = rows.nth(i);
        // Two lines: line 2 sits below line 1.
        const one = (await row.locator('[data-line="1"]').boundingBox())!;
        const two = (await row.locator('[data-line="2"]').boundingBox())!;
        expect(two.y).toBeGreaterThanOrEqual(one.y + one.height - 1);
        boxes.push((await row.boundingBox())!);
      }
      for (let i = 1; i < boxes.length; i++) {
        const [a, b] = [boxes[i - 1], boxes[i]];
        const overlap = a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1 && a.x === b.x;
        expect(overlap, `rows ${i - 1} and ${i} overlap`).toBe(false);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const sideways = await sheet.evaluate((el) => [...el.querySelectorAll('*')].filter((c) => !c.closest('.visually-hidden') && c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflowX !== 'visible').length);
      expect(sideways).toBe(0);
    });

    test('every row can be scrolled into the bottom 40 % of the screen', async ({ page }) => {
      const sheet = page.locator('[data-resource-sheet]');
      await openAllGroups(page);
      const ids = await sheet.locator('[data-resource-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-resource-row')!));
      for (const id of ids) {
        const bottom = await page.evaluate((rid) => {
          const el = document.querySelector(`[data-resource-row="${rid}"]`)!;
          el.scrollIntoView({ block: 'end' });
          return el.getBoundingClientRect().bottom;
        }, id);
        expect(bottom, id).toBeGreaterThanOrEqual(size.height * 0.6);
        expect(bottom, id).toBeLessThanOrEqual(size.height + 1);
      }
    });

    test('a tap on a row opens where it comes from and what spends it', async ({ page }) => {
      const sheet = page.locator('[data-resource-sheet]');
      const food = sheet.locator('[data-resource-row="food"]');
      await openAllGroups(page);
      await food.locator('[data-action="resource-peek"]').click();
      await expect(sheet.locator('[data-resource-peek="food"] [data-peek="from"]')).not.toBeEmpty();
      await expect(sheet.locator('[data-resource-peek="food"] [data-peek="spent"]')).not.toBeEmpty();
    });
  });
}
