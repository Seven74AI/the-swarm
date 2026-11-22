import { test, expect, type Page } from '@playwright/test';
import { frames } from './helpers/time';
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
  // The longest enemy card title and trait line (Story 4.1): SCORPION · VENOM RESISTANCE.
  nextEnemy: 'scorpion',
  stats: { totalEggsLaid: 5000, totalClicks: 800, playTimeMs: 0 },
  // Every automation target row (Story 4.10) is open in Space; the longest values and a warn line.
  automation: {
    targets: {
      lay: { target: 999, on: true },
      train: { target: 999, on: true },
      scout: { target: 999, on: true },
      warrior: { target: 999, on: true },
    },
  },
};

/** BUILD cards added by Story 4.7: they must fit with the rest. */
const COLONY_CHOICES = ['fungus_garden', 'tunnels'] as const;

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
  await frames(page, 2);
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
    // The strip is capped (34dvh): its content must fit, or anything that scrolls it pushes the top bar out (#383).
    const strip = document.querySelector<HTMLElement>('[data-shell-strip]');
    if (strip && shown(strip) && strip.scrollHeight > strip.clientHeight + 1) {
      problems.push(`strip scrolls: ${strip.scrollHeight} > ${strip.clientHeight}`);
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
        // The Colony's nectar buildings (Story 4.7) are among BUILD's cards.
        if (place.tab === 'build') {
          for (const id of COLONY_CHOICES) await expect(page.locator(`[data-building="${id}"]`)).toBeVisible();
        }
        found.push(...(await layoutProblems(page)).map((p) => `${where}: ${p}`));
      }
      // The resource sheet: its aligned table stacks below 28 columns.
      await page.locator('[data-resource-strip]').click();
      await expect(page.locator('[data-sheet="modal"]')).toBeVisible();
      found.push(...(await layoutProblems(page)).map((p) => `resource sheet: ${p}`));
      expect(found).toEqual([]);
    });

    test('the Phase 1 upgrade cards fit the screen too (Story 4.6)', async ({ page }) => {
      await seed(page, setup, {
        phase: 'egg_laying',
        resources: { eggs: 0, larvae: 0, workers: 2, food: 1_000_000, nestCapacity: 25 },
        eggPipeline: { count: 0, progress: 0 },
        larvaPipeline: { count: 0, progress: 0 },
      });
      await expect(page.locator('[data-action="buy-upgrade"]').first()).toBeAttached();
      expect(await page.locator('[data-nest-host="click-power"] [data-card]').count()).toBeGreaterThanOrEqual(4);
      expect(await layoutProblems(page)).toEqual([]);
    });

    test('the automation target rows fit the screen too (Story 4.10)', async ({ page }) => {
      await seed(page, setup);
      const found: string[] = [];
      for (const [place, verbs] of [
        [{ tab: 'nest' }, ['lay']],
        [{ tab: 'front', segment: 'war' }, ['train']],
        [{ tab: 'front', segment: 'map' }, ['scout', 'warrior']],
      ] as const) {
        await openTab(page, place.tab, 'segment' in place ? place.segment : undefined);
        for (const verb of verbs) {
          const row = page.locator(`[data-automation="${verb}"]`);
          await row.scrollIntoViewIfNeeded();
          await expect(row).toBeVisible();
          await expect(row.locator('[data-automation-status]')).toBeVisible();
        }
        found.push(...(await layoutProblems(page)).map((p) => `${place.tab}: ${p}`));
      }
      expect(found).toEqual([]);
    });

    test('the save sheets and the SAVE FAILED marker fit the screen too (Story 2.2)', async ({ page }) => {
      // A save that couldn't be read: its sheet comes up over the game.
      await page.setViewportSize({ width: setup.width, height: setup.height });
      await page.addInitScript(
        ({ fontPx }) => {
          if (!sessionStorage.getItem('unreadable-done')) {
            localStorage.setItem('the_swarm_save', '{"version": 19, "gameState": {');
            localStorage.setItem('the_swarm_onboarding', 'done');
          }
          if (fontPx) {
            const apply = () => document.documentElement?.style.setProperty('font-size', `${fontPx}px`);
            apply();
            document.addEventListener('readystatechange', apply);
          }
        },
        { fontPx: setup.fontPx ?? 0 },
      );
      await page.goto('/');
      await expect(page.locator('[data-unreadable-save]')).toBeVisible();
      const found = (await layoutProblems(page)).map((p) => `unreadable sheet: ${p}`);

      // A running game whose writes fail: the marker under the strip, then its sheet.
      await page.evaluate(() => sessionStorage.setItem('unreadable-done', '1'));
      await seed(page, setup);
      await page.evaluate(() => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k: string, v: string) {
          if (k.startsWith('the_swarm_save')) throw new DOMException('full', 'QuotaExceededError');
          return set.call(this, k, v);
        };
        const w = window as unknown as { __swarm: { saveManager: { save(s: unknown, t: number, f: boolean): boolean }; manager: { getState(): unknown } } };
        w.__swarm.saveManager.save(w.__swarm.manager.getState(), 0, true);
      });
      await expect(page.locator('[data-save-failed]')).toBeVisible();
      found.push(...(await layoutProblems(page)).map((p) => `save failed marker: ${p}`));
      await page.locator('[data-save-failed]').click();
      await expect(page.locator('[data-save-failed-sheet]')).toBeVisible();
      found.push(...(await layoutProblems(page)).map((p) => `save failed sheet: ${p}`));
      expect(found).toEqual([]);
    });

    test('the offline summary fits the screen too (Story 2.9)', async ({ page }) => {
      // Back past the cap with upkeep outrunning food: every line the summary can show.
      await page.setViewportSize({ width: setup.width, height: setup.height });
      const away = Date.now() - 30 * 3_600_000;
      await page.addInitScript(
        ({ save, fontPx }) => {
          if (sessionStorage.getItem('seeded')) return;
          sessionStorage.setItem('seeded', '1');
          localStorage.setItem('the_swarm_save', save);
          localStorage.setItem('the_swarm_onboarding', 'done');
          if (fontPx) {
            const apply = () => document.documentElement?.style.setProperty('font-size', `${fontPx}px`);
            apply();
            document.addEventListener('readystatechange', apply);
          }
        },
        {
          save: JSON.stringify({
            version: 18, timestamp: away, lastSeenAt: away, playTimeMs: 0,
            gameState: { ...SPACE, resources: { ...SPACE.resources, food: 50 }, workersAssigned: { gather: 0, tend: 78, dig: 0, guard: 2, researchers: 0 } },
          }),
          fontPx: setup.fontPx ?? 0,
        },
      );
      await page.goto('/');
      const sheet = page.locator('.offline-summary-popup');
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('[data-offline-cap]')).toBeVisible();
      await expect(sheet.locator('[data-offline-warn="starved"]')).toBeVisible();
      expect((await layoutProblems(page)).map((p) => `offline summary: ${p}`)).toEqual([]);
    });

    test('the battle summary with its cause line and > CHANGE fits the screen too (Story 4.3)', async ({ page }) => {
      // One soldier cannot beat the beetle: the summary shows a cause, and a counter with its shortfall.
      await seed(page, setup, {
        ...SPACE,
        combatSoldiers: 1,
        nextEnemy: 'beetle',
        buildings: { ...SPACE.buildings, chitin_armory: { level: 1 }, silk_weaving: { level: 1 } },
        combatResources: { chitin: 0, silk: 0, venom: 0 },
      });
      await openTab(page, 'front', 'war');
      await page.locator('[data-primary-for="front"] [data-action="fight"]').click();
      const sheet = page.locator('[data-battle-summary]');
      await expect(sheet).toBeVisible({ timeout: 5000 });
      await expect(sheet.locator('[data-cause]')).toBeVisible();
      await expect(sheet.locator('button[data-action="change"]')).toBeVisible();
      expect((await layoutProblems(page)).map((p) => `battle summary: ${p}`)).toEqual([]);
    });

    test('BUILD with built workshops (MAX) and the Midden fits the screen too (Story 4.8)', async ({ page }) => {
      await seed(page, setup, {
        ...SPACE,
        buildings: { ...SPACE.buildings, chitin_armory: { level: 1 }, silk_weaving: { level: 1 }, midden: { level: 2 } },
      });
      await openTab(page, 'build');
      const build = page.locator('[data-tab-panel="build"]');
      await expect(build.locator('[data-building="midden"]')).toBeVisible();
      await expect(build.locator('[data-building="chitin_armory"] .card__level')).toContainText('MAX');
      expect((await layoutProblems(page)).map((p) => `build: ${p}`)).toEqual([]);
    });

    test('LOG → LEGACY with what the next prestige needs fits the screen too (Story 5.1)', async ({ page }) => {
      // A run after a prestige: LEGACY stays, and every requirement is short.
      await seed(page, setup, {
        ...SPACE,
        prestige: { count: 1, legacyPoints: 0, totalFoodProduced: 0, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 },
      });
      await openTab(page, 'log');
      await expect(page.locator('[data-prestige-needs] li[data-requirement]').first()).toBeVisible();
      expect((await layoutProblems(page)).map((p) => `legacy: ${p}`)).toEqual([]);
    });

    test('the settings sheet and the import sheets fit the screen too (Story 2.11)', async ({ page }) => {
      // More contrast turns CRT effects OFF at boot (Story 8.4), so the CRT row's longest note is checked too.
      await page.emulateMedia({ contrast: 'more' });
      await seed(page, setup);
      const openSettings = async () => {
        await page.locator('[data-resource-strip]').click();
        await page.locator('[data-resource-sheet] [data-action="settings"]').click();
        await expect(page.locator('[data-settings-sheet]')).toBeVisible();
      };
      const pick = async (text: string) => {
        await openSettings();
        const chooser = page.waitForEvent('filechooser');
        await page.locator('[data-settings-sheet] [data-action="import-save"]').click();
        await (await chooser).setFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(text) });
      };
      await openSettings();
      // EXPORT TELEMETRY (Story 3.10) is one of the controls checked.
      await expect(page.locator('[data-settings-sheet] [data-action="export-telemetry"]')).toBeVisible();
      await expect(page.locator('[data-setting="crt"] [data-setting-note]').filter({ hasText: 'DEVICE' })).toBeVisible();
      const found = (await layoutProblems(page)).map((p) => `settings sheet: ${p}`);
      await page.locator('[data-settings-sheet] [data-sheet-close]').click();
      await pick(JSON.stringify({ version: 999, timestamp: Date.now(), playTimeMs: 0, gameState: { phase: 'egg_laying', resources: {} } }));
      await expect(page.locator('[data-import-refused]')).toBeVisible();
      found.push(...(await layoutProblems(page)).map((p) => `import refused sheet: ${p}`));
      await page.locator('[data-import-refused] [data-sheet-close]').click();
      const save = await page.evaluate(() => localStorage.getItem('the_swarm_save')!);
      await pick(save);
      await expect(page.locator('[data-import-confirm]')).toBeVisible();
      found.push(...(await layoutProblems(page)).map((p) => `import confirm sheet: ${p}`));
      expect(found).toEqual([]);
    });

    test('the title cinematic fits the screen too, every stage (Story 8.10)', async ({ page }) => {
      await seed(page, setup);
      await page.locator('[data-resource-strip]').click();
      await page.locator('[data-resource-sheet] [data-action="settings"]').click();
      await page.locator('[data-settings-sheet] [data-action="replay-intro"]').click();
      const cinematic = page.locator('[data-overlay="title-cinematic"]');
      await expect(cinematic).toHaveAttribute('data-stage', 'playing');
      const found = (await layoutProblems(page)).map((p) => `playing: ${p}`);
      await page.keyboard.press('Escape');
      await expect(cinematic).toHaveAttribute('data-stage', 'title');
      found.push(...(await layoutProblems(page)).map((p) => `title frame: ${p}`));
      await page.locator('[data-action="wake-queen"]').click();
      await expect(page.locator('[data-title-alone]')).toBeVisible();
      found.push(...(await layoutProblems(page)).map((p) => `alone: ${p}`));
      expect(found).toEqual([]);
    });

    test('the debug overlay fits the screen too', async ({ page }) => {
      // Story 1.34: dev builds (this server) and ?debug=1; one inspector key open.
      await seed(page, setup);
      await expect(page.locator('[data-debug-root][data-ready]')).toBeAttached();
      await page.keyboard.press('Backquote');
      await page.locator('[data-debug-inspector] [data-key="resources"] summary').click();
      await expect(page.locator('[data-debug-inspector] [data-key="resources"] pre')).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
    });

    test('the add-to-home-screen hint fits the screen too (Story 2.12)', async ({ page }) => {
      // A mobile browser (coarse pointer) that isn't the installed app, past the first phase.
      await page.addInitScript(() => {
        const real = window.matchMedia.bind(window);
        window.matchMedia = (q: string) => (q === '(pointer: coarse)' ? ({ ...real(q), matches: true } as MediaQueryList) : real(q));
      });
      await seed(page, setup);
      await expect(page.locator('[data-home-screen-hint]')).toBeVisible();
      expect((await layoutProblems(page)).map((p) => `home-screen hint: ${p}`)).toEqual([]);
    });
  });
}

test.describe('Text reflow: the rules behind the layout', () => {
  test('the character grid is computed from the content width and the text size', async ({ page }) => {
    await seed(page, { name: 'phone', width: 390, height: 844 });
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-grid', 'full');
    const cols = async () => Number(await root.getAttribute('data-grid-cols'));
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

  test('glyphs are line drawings that grow with the text size (Story 8.2)', async ({ page }) => {
    await seed(page, { name: 'phone', width: 390, height: 844 });
    const glyph = page.locator('[data-strip-cell] [data-glyph] svg.glyph').first();
    await expect(glyph).toBeVisible();
    await expect(glyph).toHaveAttribute('aria-hidden', 'true');
    const width = () => glyph.evaluate((el) => el.getBoundingClientRect().width);
    const normal = await width();
    expect(normal).toBeGreaterThan(0);
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '32px'));
    await expect.poll(width).toBeGreaterThan(normal * 1.5);
    await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
    await expect.poll(width).toBeLessThan(normal * 1.5);
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
    // NEST's primary carries no cost; WAR's FIGHT does (`N SOLDIERS`).
    await openTab(page, 'front', 'war');
    const costs = page.locator('[data-primary-zone] [data-cost]').filter({ visible: true });
    await expect(costs.first()).toBeVisible();
    for (const cost of await costs.all()) {
      expect(await cost.evaluate((el) => el.closest('button') !== null)).toBe(true);
    }
    // Back on NEST, with room again, every line shows.
    await openTab(page, 'nest');
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
