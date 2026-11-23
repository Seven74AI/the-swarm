import { test, expect, type Page } from '@playwright/test';
import { settleReveals } from './helpers/reveal';

/**
 * Story 9.7 (UX-DR48, UX-DR5, NFR7, NFR9): from Colony on, NEST is laid out
 * around digging. Seeded with a Colony save past the real Egg Laying guard
 * (10 workers), below Colony's own goal so it never latches.
 */
const COLONY = {
  phase: 'colony',
  resources: { eggs: 4, larvae: 2, workers: 30, food: 5_000, nestCapacity: 40, wood: 100, stone: 300, nectar: 0 },
  eggPipeline: { count: 4, progress: 0 },
  larvaPipeline: { count: 2, progress: 0 },
  workersAssigned: { gather: 10, forage: 0, tend: 0, dig: 10, guard: 1, researchers: 0 },
  dig: { roomsDug: 3, progress: 9_000, carry: 0, roomsByHand: 3, auto: false },
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript((save) => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    localStorage.setItem('the_swarm_save', save);
  }, JSON.stringify({ version: 36, timestamp: Date.now(), playTimeMs: 0, gameState: COLONY }));
  await page.goto('/');
  await expect(page.locator('[data-tab-panel="nest"]')).toBeVisible();
  await expect(page.locator('[data-brood-feed]')).toBeVisible();
  await settleReveals(page);
}

const ORDER = [
  '[data-tab-panel="nest"] [data-goal-meter="full"]',
  '[data-nest-scene] [data-scene="nest"]',
  '[data-next-room]',
  '[data-brood-feed]',
  '#activity-log',
] as const;

for (const size of [
  { width: 390, height: 844 },
  { width: 360, height: 512 },
]) {
  test.describe(`NEST digging layout on ${size.width}×${size.height} (Story 9.7)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
      await seed(page);
    });

    test('reads goal, scene, NEXT ROOM, brood line, event lines, then > DIG, top to bottom, with no overlap', async ({ page }) => {
      const boxes = [];
      for (const sel of ORDER) {
        const box = await page.locator(sel).first().boundingBox();
        expect(box, sel).not.toBeNull();
        boxes.push({ sel, ...box! });
      }
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].y, `${boxes[i].sel} below ${boxes[i - 1].sel}`).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height - 1);
      }
      // > DIG is pinned at the bottom: scrolled into view, the event lines end above it, never under it.
      await page.locator('#activity-log').scrollIntoViewIfNeeded();
      const log = (await page.locator('#activity-log').boundingBox())!;
      const zone = (await page.locator('[data-primary-for="nest"]').boundingBox())!;
      expect(log.y + log.height).toBeLessThanOrEqual(zone.y + 1);
    });

    test('the goal block takes at most 4 lines, and the brood line one', async ({ page }) => {
      const lines = (sel: string) =>
        page.locator(sel).first().evaluate((el) => {
          // Distinct line tops of the text inside (each text node's client rects).
          const tops = new Set<number>();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top / 4));
          }
          return tops.size;
        });
      expect(await lines('[data-tab-panel="nest"] [data-goal-meter="full"]')).toBeLessThanOrEqual(4);
      const brood = (await page.locator('[data-brood-feed]').boundingBox())!;
      const control = (await page.locator('[data-brood-feed] button').first().boundingBox())!;
      // One row: the line is no taller than its tallest control plus a little.
      expect(brood.height).toBeLessThan(control.height * 1.6);
      // And it fits the screen: nothing in it is cut off at either side.
      const fits = await page.locator('[data-brood-feed]').evaluate((el) => {
        const r = el.getBoundingClientRect();
        const inner = [...el.querySelectorAll('*')].every((c) => {
          const b = c.getBoundingClientRect();
          return b.width === 0 || (b.left >= r.left - 0.5 && b.right <= r.right + 0.5);
        });
        return el.scrollWidth <= el.clientWidth && r.left >= 0 && r.right <= window.innerWidth && inner;
      });
      expect(fits).toBe(true);
    });

    test('the brood line names the brood and carries the laying target', async ({ page }) => {
      const line = page.locator('[data-brood-feed]');
      await expect(line.locator('[data-brood-counts]')).toHaveText(/^BROOD\W+4 EGGS\W+2 LARVAE$/);
      await expect(line.locator('[data-automation="lay"]')).toBeVisible();
      await expect(line).toContainText('KEEP');
      await expect(line.locator('button[data-action="toggle-automation"]')).toBeVisible();
    });

    test('> DIG carries its hint line, stays in the bottom 40 %, and nothing scrolls sideways', async ({ page }) => {
      const zone = (await page.locator('[data-primary-for="nest"]').boundingBox())!;
      expect(zone.y).toBeGreaterThanOrEqual(size.height * 0.6 - 1);
      await expect(page.locator('[data-primary-for="nest"]')).toContainText(/chunk \+\d+/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('every control on NEST and in its primary zone is at least 44×44 px', async ({ page }) => {
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const roots = [document.querySelector('[data-tab-panel="nest"]'), document.querySelector('[data-primary-for="nest"]')];
        for (const root of roots) {
          for (const el of root?.querySelectorAll<HTMLElement>('button, [role="button"], input, a[href]') ?? []) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.push(`${el.outerHTML.slice(0, 80)} ${Math.round(r.width)}×${Math.round(r.height)}`);
          }
        }
        return out;
      });
      expect(small).toEqual([]);
    });
  });
}
