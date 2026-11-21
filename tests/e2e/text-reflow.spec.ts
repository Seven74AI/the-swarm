import { test, expect, type Page } from '@playwright/test';
import { openTab, type SegmentId, type TabId } from './helpers/tabs';

/**
 * Story 1.31 (UX-DR4, UX-DR5 height rules, UX-DR6 landscape, NFR7): text
 * reflows at large sizes and narrow screens. Every tab is checked at 320 px
 * wide, at 200 % text, below 560 px and below 480 px of height. The
 * assertions are invariants of the layout (nothing wider than the screen,
 * nothing clipped, 44 px targets), never pixel snapshots or balance numbers.
 */

/** Space, below its goal: every tab and every FRONT segment has content, and nothing latches. */
const SPACE = {
  phase: 'space',
  resources: {
    eggs: 5, larvae: 3, workers: 80, food: 5000, nestCapacity: 1000, wood: 500, stone: 500, nectar: 300,
    voidCrystals: 10, antimatter: 5, darkMatter: 2,
  },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 40, tend: 6, dig: 3, guard: 2, researchers: 0 },
  soldiers: { scouts: 10, warriors: 5, totalKilled: 2 },
  buildings: { barracks: { level: 2, count: 1 }, walls: { level: 2 }, warehouse: { level: 2 } },
  combatSoldiers: 5,
  battlesWon: 6,
  stats: { totalEggsLaid: 5000, totalClicks: 800, playTimeMs: 0 },
};

interface Setup {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Root font size in px: 16 is 100 %, 32 is 200 % text. */
  readonly fontPx?: number;
}

const SETUPS: readonly Setup[] = [
  { name: '320 px wide', width: 320, height: 640 },
  { name: '200 % text', width: 390, height: 844, fontPx: 32 },
  { name: '320 px wide at 200 % text', width: 320, height: 640, fontPx: 32 },
  { name: 'below 560 px tall', width: 360, height: 540 },
  { name: 'landscape below 480 px tall', width: 740, height: 400 },
];

const PLACES: readonly { tab: TabId; segment?: SegmentId }[] = [
  { tab: 'nest' },
  { tab: 'wrkr' },
  { tab: 'build' },
  { tab: 'front', segment: 'war' },
  { tab: 'front', segment: 'map' },
  { tab: 'front', segment: 'stars' },
  { tab: 'log' },
];

async function seed(page: Page, setup: Setup, gameState: Record<string, unknown> = SPACE): Promise<void> {
  await page.setViewportSize({ width: setup.width, height: setup.height });
  await page.addInitScript(
    ({ save, fontPx }) => {
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'done');
      // The player's text size: set on the root before the game's scripts run.
      if (fontPx) {
        const apply = () => document.documentElement?.style.setProperty('font-size', `${fontPx}px`);
        apply();
        document.addEventListener('readystatechange', apply);
      }
    },
    { save: JSON.stringify({ version: 18, timestamp: Date.now(), playTimeMs: 0, gameState }), fontPx: setup.fontPx ?? 0 },
  );
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/**
 * Layout problems on screen now: anything reaching past the screen's sides,
 * any element whose content is cut off sideways, anything spilling out of
 * the pinned strip, primary zone or tab bar, and tap targets under 44 px.
 */
async function layoutProblems(page: Page): Promise<string[]> {
  // Reveal animations move panels for a moment (some start a frame after a tab opens):
  // measure the settled layout.
  await page.waitForTimeout(100);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((a) => a.playState === 'running' && (a.effect as KeyframeEffect | null)?.target?.matches('.panel-revealed'))
              .length,
        ),
      { timeout: 5_000 },
    )
    .toBe(0);
  return page.evaluate(() => {
    const problems: string[] = [];
    const vw = document.documentElement.clientWidth;
    const name = (el: Element) => {
      const h = el as HTMLElement;
      const hooks = [...h.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'id').map((a) => `${a.name}=${a.value}`);
      return `<${h.tagName.toLowerCase()} ${hooks.join(' ')} class="${h.className}"> "${(h.textContent ?? '').trim().slice(0, 30)}"`;
    };
    if (document.documentElement.scrollWidth > vw + 1) problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
    const shown = (el: Element): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.closest('.visually-hidden')) return false;
      const r = el.getBoundingClientRect();
      // Screen-reader-only text (1 px boxes) is not on screen.
      if (r.width <= 1 || r.height <= 1) return false;
      return getComputedStyle(el).visibility !== 'hidden';
    };
    for (const el of document.querySelectorAll('body *')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) problems.push(`off screen (${Math.round(r.left)}..${Math.round(r.right)} of ${vw}): ${name(el)}`);
      const cs = getComputedStyle(el);
      // DESIGN.md: on the full and medium grid a primary label truncates its target, never its verb.
      const designedTruncation = el.matches('.swarm-btn__target') && document.documentElement.dataset.grid !== 'narrow';
      if (cs.overflowX !== 'visible' && !designedTruncation && el.scrollWidth > el.clientWidth + 1) {
        problems.push(`cut off sideways (${el.scrollWidth} > ${el.clientWidth}): ${name(el)}`);
      }
    }
    for (const sel of ['[data-shell-strip]', '[data-primary-zone] > :not([hidden])', '[data-tab-bar]']) {
      for (const box of document.querySelectorAll(sel)) {
        if (!shown(box)) continue;
        const b = box.getBoundingClientRect();
        for (const el of box.querySelectorAll('*')) {
          if (!shown(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.bottom > b.bottom + 1 || r.top < b.top - 1) problems.push(`spills out of ${sel}: ${name(el)}`);
        }
      }
    }
    for (const el of document.querySelectorAll('button, [role="tab"], [role="button"], a[href], input, select')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) problems.push(`target ${Math.round(r.width)}×${Math.round(r.height)}: ${name(el)}`);
    }
    return problems;
  });
}

for (const setup of SETUPS) {
  test.describe(`Text reflow: ${setup.name}`, () => {
    test('every tab fits the screen: no sideways scroll, nothing clipped, 44 px targets', async ({ page }) => {
      await seed(page, setup);
      const found: string[] = [];
      for (const place of PLACES) {
        await openTab(page, place.tab, place.segment);
        const where = `${place.tab}${place.segment ? `/${place.segment}` : ''}`;
        found.push(...(await layoutProblems(page)).map((p) => `${where}: ${p}`));
      }
      // The resource sheet: its aligned table stacks below 28 columns.
      await page.locator('[data-resource-strip]').click();
      await expect(page.locator('[data-sheet="modal"]')).toBeVisible();
      found.push(...(await layoutProblems(page)).map((p) => `resource sheet: ${p}`));
      expect(found).toEqual([]);
    });
  });
}

test.describe('Text reflow: the rules behind the layout', () => {
  test('the character grid is computed from the content width and the text size', async ({ page }) => {
    await seed(page, { name: 'phone', width: 390, height: 844 });
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-grid', 'full');
    const cols = async () => Number(await root.evaluate((el) => el.style.getPropertyValue('--grid-cols')));
    const wide = await cols();
    expect(wide).toBeGreaterThanOrEqual(36);
    // The player doubles the text size: fewer columns, and the narrow rules apply.
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '32px'));
    await expect(root).toHaveAttribute('data-grid', 'narrow');
    expect(await cols()).toBeLessThan(wide);
    // Below 28 columns meters read `74 % ████····` and the strip narrows.
    await expect(page.locator('[data-goal-meter="full"] .meter')).toHaveAttribute('data-meter-form', 'short');
    await expect(page.locator('[data-resource-strip]')).toHaveAttribute('data-compact', 'true');
    // Back to normal text: the full design again.
    await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
    await expect(root).toHaveAttribute('data-grid', 'full');
    await expect(page.locator('[data-goal-meter="full"] .meter')).toHaveAttribute('data-meter-form', 'bar');
  });

  test('page margins are 14 px, and 8 px below 360 px', async ({ page }) => {
    const margin = () =>
      page.locator('[data-shell-scroll]').evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    await seed(page, { name: 'phone', width: 375, height: 667 });
    expect(await margin()).toBe(14);
    await page.setViewportSize({ width: 320, height: 640 });
    await expect.poll(margin).toBe(8);
  });

  test('below 560 px tall NEST shows one event line; the primary action holds its cost line', async ({ page }) => {
    await seed(page, { name: 'short', width: 360, height: 540 });
    const lines = page.locator('[data-tab-panel="nest"] .event-line');
    expect(await lines.count()).toBeGreaterThan(1);
    await expect(lines.first()).toBeVisible();
    for (let i = 1; i < (await lines.count()); i++) await expect(lines.nth(i)).toBeHidden();
    // Every cost line of a primary action sits inside its button, inside the zone.
    for (const cost of await page.locator('[data-primary-zone] [data-cost]').all()) {
      if (!(await cost.isVisible())) continue;
      expect(await cost.evaluate((el) => el.closest('button') !== null)).toBe(true);
    }
    // LOG keeps every line.
    await page.setViewportSize({ width: 360, height: 700 });
    await expect(lines.nth(1)).toBeVisible();
  });

  test('below 480 px tall the primary zone un-pins and scrolls with the content', async ({ page }) => {
    await seed(page, { name: 'landscape', width: 740, height: 400 });
    const zone = page.locator('[data-primary-zone]');
    expect(await zone.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
    // It sits after the content, below the fold, and the page scrolls to it.
    expect((await zone.boundingBox())!.y).toBeGreaterThan(400);
    const primary = page.locator('[data-primary-for="nest"] button').first();
    await primary.scrollIntoViewIfNeeded();
    await expect(primary).toBeInViewport();
    // Taller again: pinned at the bottom.
    await page.setViewportSize({ width: 740, height: 600 });
    await expect.poll(() => zone.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  });
});
