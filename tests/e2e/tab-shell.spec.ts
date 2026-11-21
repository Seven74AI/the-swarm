import { test, expect, type Page } from '@playwright/test';
import { openTab } from './helpers/tabs';

/**
 * Story 1.15: five tabs, one primary action, thumb-reachable (FR45, UX-DR5, UX-DR9).
 */

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 14, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 20, food: 500, nestCapacity: 100, wood: 0, stone: 0, nectar: 0 },
};

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 360, height: 512 },
];

test.describe('Tab shell', () => {
  test('Phase 1 shows no tab bar; the lay-egg button is the primary action', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, { phase: 'egg_laying' });
    await expect(page.locator('[data-tab-bar]')).toBeHidden();
    await expect(page.locator('[data-primary-zone] #click-egg')).toBeVisible();
  });

  test('entering Colony shows NEST · WRKR · BUILD · LOG; the worker panel lives in WRKR', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, COLONY);
    const tabs = page.locator('[data-tab-bar] [data-tab]');
    await expect(tabs).toHaveCount(4);
    expect(await tabs.evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))).toEqual(['nest', 'wrkr', 'build', 'log']);

    await expect(page.locator('#worker-assignment')).toBeHidden();
    await openTab(page, 'wrkr');
    await expect(page.locator('[data-tab-panel="wrkr"] #worker-assignment')).toBeVisible();
    await expect(page.locator('[data-tab-panel="wrkr"] #food-display')).toBeVisible();
    // The lay-egg button belongs to NEST's primary zone.
    await expect(page.locator('#click-egg')).toBeHidden();
    await openTab(page, 'nest');
    await expect(page.locator('#click-egg')).toBeVisible();
  });

  test('Combat adds FRONT, with the WAR segment holding the soldier panel', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, { ...COLONY, phase: 'combat' });
    await expect(page.locator('[data-tab-bar] [data-tab]')).toHaveCount(5);
    await openTab(page, 'front', 'war');
    await expect(page.locator('[data-segment-panel="war"] #soldier-panel')).toBeVisible();
  });

  for (const vp of VIEWPORTS) {
    test(`at ${vp.width}×${vp.height} the strip is on top and the primary zone and tab bar sit in the bottom 40%`, async ({ page }) => {
      await page.setViewportSize(vp);
      await seed(page, COLONY);
      const box = async (sel: string) => {
        const b = await page.locator(sel).boundingBox();
        expect(b, sel).not.toBeNull();
        return b!;
      };
      const strip = await box('[data-shell-strip]');
      const zone = await box('[data-primary-zone]');
      const bar = await box('[data-tab-bar]');
      expect(strip.y).toBeLessThanOrEqual(1);
      expect(Math.round(zone.height)).toBe(64);
      expect(Math.round(bar.height)).toBe(52);
      expect(zone.y).toBeGreaterThanOrEqual(vp.height * 0.6);
      expect(bar.y).toBeGreaterThanOrEqual(zone.y + zone.height - 1);
      expect(bar.y + bar.height).toBeLessThanOrEqual(vp.height + 1);

      // The scroll area is padded by the zone and bar together.
      const pad = await page.locator('[data-shell-scroll]').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
      expect(pad).toBeGreaterThanOrEqual(zone.height + bar.height - 1);
    });
  }

  test('the active tab is inverse video and the others are not', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, COLONY);
    await openTab(page, 'build');
    const colors = (sel: string) => page.locator(sel).evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, fg: s.color };
    });
    const active = await colors('[data-tab="build"]');
    const idle = await colors('[data-tab="wrkr"]');
    const accent = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = 'var(--color-accent)';
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(active.bg).toBe(accent);
    expect(idle.bg).not.toBe(accent);
    // No numeric badges in the bar.
    await expect(page.locator('[data-tab-bar]')).not.toContainText(/\d/);
  });

  test('each tab keeps its scroll position; tapping the active tab scrolls to the top', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 512 });
    await seed(page, COLONY);
    await openTab(page, 'wrkr');
    const scroller = page.locator('[data-shell-scroll]');
    // Make sure the tab can scroll.
    const max = await scroller.evaluate((el) => el.scrollHeight - el.clientHeight);
    test.skip(max < 40, 'WRKR content fits without scrolling at this size');
    await scroller.evaluate((el) => { el.scrollTop = 40; });

    await openTab(page, 'nest');
    await openTab(page, 'wrkr');
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(39);

    await page.locator('[data-tab="wrkr"]').click();
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('a tab shows • when something on it becomes affordable, and clears on visit', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await seed(page, { ...COLONY, phase: 'combat', combatResources: { chitin: 0, silk: 0, venom: 0 } });
    const dot = page.locator('[data-tab="front"] [data-tab-dot]');
    await expect(dot).toHaveCount(0);
    await page.evaluate(() => {
      const w = window as unknown as { __swarm: { manager: { getState(): Record<string, unknown>; setState(s: unknown): void } } };
      const s = w.__swarm.manager.getState();
      w.__swarm.manager.setState({ ...s, combatResources: { chitin: 1e6, silk: 1e6, venom: 1e6 } });
    });
    await expect(dot).toHaveText('•');
    await openTab(page, 'front');
    await expect(dot).toHaveCount(0);
  });
});
