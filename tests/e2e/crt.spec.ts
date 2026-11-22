import { test, expect, type Page } from '@playwright/test';

/**
 * Story 8.4 (UX-DR36): CRT effects, off text by default.
 *
 * SCENE (default) puts scanlines only on the scene surfaces (the nest scene,
 * the full-screen overlays), under their text, never on the strip, the tab
 * bar or sheets; line-work glows 3 px; accent text of 15 px and up has a
 * text-shadow of at most 2 px at no more than 35%. FULL puts scanlines over
 * everything; OFF removes scanlines and every glow. The device turns them OFF
 * at boot when it asks for more contrast, reduced transparency or a text scale
 * above 130%. Scanlines are measured in whole device pixels.
 * Invariants only: no pixel snapshots.
 */

const COLONY = {
  phase: 'colony',
  resources: { eggs: 0, larvae: 0, workers: 5, food: 50, nestCapacity: 50 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
};

interface SeedOptions {
  crt?: string;
  /** Root font size in px: 16 is 100 % text. */
  fontPx?: number;
}

async function seed(page: Page, { crt, fontPx = 0 }: SeedOptions = {}): Promise<void> {
  await page.addInitScript(
    ([save, prefs, px]: [string, string | null, number]) => {
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'done');
      if (prefs) localStorage.setItem('the_swarm_settings', prefs);
      if (px) {
        const apply = () => document.documentElement?.style.setProperty('font-size', `${px}px`);
        apply();
        document.addEventListener('readystatechange', apply);
      }
    },
    [
      JSON.stringify({ version: 18, timestamp: Date.now(), playTimeMs: 0, gameState: COLONY }),
      crt ? JSON.stringify({ version: 3, settings: { crt } }) : null,
      fontPx,
    ] as [string, string | null, number],
  );
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** The scanline layer an element draws: its ::after background, if that is a gradient. */
const scanlinesOn = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const after = getComputedStyle(el, '::after');
    return after.content !== 'none' && /gradient/.test(after.backgroundImage);
  });
const bodyScanlines = (page: Page) =>
  page.evaluate(() => {
    const after = getComputedStyle(document.body, '::after');
    return {
      on: after.content !== 'none' && /gradient/.test(after.backgroundImage),
      position: after.position,
      pointerEvents: after.pointerEvents,
    };
  });

/**
 * Lengths (px) and alpha of a computed text-shadow, such as
 * `rgba(255, 176, 0, 0.35) 0px 0px 2px` or `color(srgb 1 0.69 0 / 0.35) 0px 0px 2px`.
 */
function parseShadow(shadow: string): { alpha: number; lengths: number[] } {
  const color = shadow.match(/(?:rgba?|color)\(([^)]*)\)/);
  let alpha = 1;
  if (color) {
    const slash = color[1].split('/');
    const parts = color[1].split(/[ ,]+/).filter(Boolean);
    if (slash.length === 2) alpha = Number(slash[1].trim());
    else if (color[0].startsWith('rgba') && parts.length === 4) alpha = Number(parts[3]);
  }
  const lengths = [...shadow.replace(/(?:rgba?|color)\([^)]*\)/, '').matchAll(/(-?[\d.]+)px/g)].map((m) => Math.abs(Number(m[1])));
  return { alpha, lengths };
}

/** Adds a piece of line-work (as the scene draws it) and reads its filter. */
const lineWorkFilter = (page: Page) =>
  page.evaluate(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-line-work', '');
    document.body.appendChild(svg);
    const filter = getComputedStyle(svg).filter;
    svg.remove();
    return filter;
  });

/** Every element in the page that still has a shadow. */
const shadowed = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => {
        const s = getComputedStyle(el);
        return s.textShadow !== 'none' || s.boxShadow !== 'none';
      })
      .map((el) => el.tagName + (el.className ? `.${String(el.className)}` : '')),
  );

const PRIMARY = '[data-variant="primary"]';
/** The nest scene's surface (Story 8.5): the stage that holds the drawing and its chamber labels. */
const NEST_SURFACE = '[data-nest-scene] [data-crt-surface]';

test.describe('SCENE (default)', () => {
  test('scanlines are on the nest scene only, never on the strip, the tab bar or sheets', async ({ page }) => {
    await seed(page);
    await expect(page.locator('html')).toHaveAttribute('data-crt', 'scene');
    await expect(page.locator('[data-nest-scene]')).toBeVisible();
    expect(await scanlinesOn(page, NEST_SURFACE)).toBe(true);
    expect((await bodyScanlines(page)).on).toBe(false);

    for (const shell of ['[data-resource-strip]', '[data-tab-bar]']) {
      await expect(page.locator(shell).first()).toBeVisible();
      // Not on it, not under a surface, and no ::after of its own.
      expect(await page.locator(shell).first().evaluate((el) => el.closest('[data-crt-surface]') === null), shell).toBe(true);
      expect(await scanlinesOn(page, shell), shell).toBe(false);
    }

    await page.locator('[data-resource-strip]').click();
    const sheet = page.locator('[data-resource-sheet]');
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate((el) => el.closest('[data-crt-surface]') === null && !el.querySelector('[data-crt-surface]'))).toBe(true);
    expect(await scanlinesOn(page, '[data-resource-sheet]')).toBe(false);
    expect((await bodyScanlines(page)).on).toBe(false);
  });

  test('on a scene surface the text sits above the scanlines', async ({ page }) => {
    await seed(page);
    const scene = page.locator(NEST_SURFACE);
    await expect(scene).toBeVisible();
    const stack = await scene.evaluate((el) => ({
      lines: Number(getComputedStyle(el, '::after').zIndex),
      text: [...el.children]
        .filter((c) => (c.textContent ?? '').trim() !== '')
        .map((c) => Number(getComputedStyle(c).zIndex)),
    }));
    expect(stack.text.length).toBeGreaterThan(0);
    for (const z of stack.text) expect(z).toBeGreaterThan(stack.lines);
  });

  test('the full-screen PAUSED overlay has scanlines, under its text', async ({ page }) => {
    await seed(page);
    await page.keyboard.press('p');
    const overlay = page.locator('[data-overlay="paused"]');
    await expect(overlay).toBeVisible();
    expect(await scanlinesOn(page, '[data-overlay="paused"]')).toBe(true);
    const lifted = await overlay.evaluate((el) => {
      const lines = Number(getComputedStyle(el, '::after').zIndex);
      return [...el.children].every((c) => Number(getComputedStyle(c).zIndex) > lines);
    });
    expect(lifted).toBe(true);
  });

  test('the title cinematic is a scene surface: scanlines under its words, its drawings glow (Story 8.10)', async ({ page }) => {
    await seed(page);
    await page.locator('[data-resource-strip]').click();
    await page.locator('[data-resource-sheet] [data-action="settings"]').click();
    await page.locator('[data-settings-sheet] [data-action="replay-intro"]').click();
    const overlay = page.locator('[data-overlay="title-cinematic"]');
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveAttribute('data-stage', 'title');
    expect(await scanlinesOn(page, '[data-overlay="title-cinematic"]')).toBe(true);
    const stack = await overlay.evaluate((el) => {
      const lines = Number(getComputedStyle(el, '::after').zIndex);
      const words = [...el.children].filter((c) => !(c instanceof SVGElement));
      return { lines, words: words.map((c) => Number(getComputedStyle(c).zIndex)) };
    });
    expect(stack.words.length).toBeGreaterThan(0);
    for (const z of stack.words) expect(z).toBeGreaterThan(stack.lines);
    const glow = await overlay.locator('svg[data-line-work]').first().evaluate((el) => getComputedStyle(el).filter);
    expect(glow).toMatch(/drop-shadow/);
  });

  test('accent text of 15 px and up glows at most 2 px at no more than 35%; line-work glows 3 px', async ({ page }) => {
    await seed(page);
    const label = page.locator(PRIMARY).first();
    await expect(label).toBeVisible();
    const { fontPx, shadow } = await label.evaluate((el) => ({
      fontPx: parseFloat(getComputedStyle(el).fontSize),
      shadow: getComputedStyle(el).textShadow,
    }));
    expect(fontPx).toBeGreaterThanOrEqual(15);
    expect(shadow).not.toBe('none');
    const { alpha, lengths } = parseShadow(shadow);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(0.35 + 1e-6);
    for (const px of lengths) expect(px).toBeLessThanOrEqual(2);

    const filter = await lineWorkFilter(page);
    expect(filter).toMatch(/drop-shadow/);
    expect(filter).toMatch(/\b3px\b/);
  });
});

test('FULL puts scanlines over everything, taps still go through, and the setting says contrast is reduced', async ({ page }) => {
  await seed(page, { crt: 'full' });
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'full');
  const full = await bodyScanlines(page);
  expect(full).toEqual({ on: true, position: 'fixed', pointerEvents: 'none' });
  // The layer covers the strip, yet a tap on the strip still opens its sheet.
  await page.locator('[data-resource-strip]').click();
  await expect(page.locator('[data-resource-sheet]')).toBeVisible();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await expect(page.locator('[data-setting="crt"]')).toContainText('CONTRAST');
});

test('OFF removes the scanlines and every glow', async ({ page }) => {
  await seed(page, { crt: 'off' });
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
  await expect(page.locator('[data-nest-scene]')).toBeVisible();
  expect(await scanlinesOn(page, NEST_SURFACE)).toBe(false);
  expect((await bodyScanlines(page)).on).toBe(false);
  expect(await shadowed(page)).toEqual([]);
  expect(await lineWorkFilter(page)).toBe('none');
});

test('picking a CRT setting applies it at once', async ({ page }) => {
  await seed(page);
  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  const row = page.locator('[data-setting="crt"]');
  await row.locator('[data-option="off"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
  await expect(row.locator('[data-option="off"]')).toHaveAttribute('aria-pressed', 'true');
  await row.locator('[data-option="full"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'full');
});

test.describe('OFF at boot when the device asks for readability', () => {
  test('more contrast', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await seed(page, { crt: 'full' });
    await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
    // The setting says why, and a pick still turns them on.
    await page.locator('[data-resource-strip]').click();
    await page.locator('[data-resource-sheet] [data-action="settings"]').click();
    const row = page.locator('[data-setting="crt"]');
    await expect(row).toContainText('DEVICE');
    await row.locator('[data-option="scene"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-crt', 'scene');
  });

  test('reduced transparency', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true);
    await seed(page);
    await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
  });

  test('a text scale above 130%, but not at 125%', async ({ page, browser }) => {
    await seed(page, { fontPx: 22 });
    await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');

    const other = await browser.newPage();
    await seed(other, { fontPx: 20 });
    await expect(other.locator('html')).toHaveAttribute('data-crt', 'scene');
    await other.close();
  });
});

test.describe('scanlines in device pixels', () => {
  for (const deviceScaleFactor of [1, 1.5, 2.625]) {
    test.describe(`at a pixel ratio of ${deviceScaleFactor}`, () => {
      test.use({ deviceScaleFactor });
      test('the scanline unit is a whole number of device pixels', async ({ page }) => {
        await seed(page);
        const { unit, dpr } = await page.evaluate(() => ({
          unit: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--crt-px')),
          dpr: devicePixelRatio,
        }));
        expect(dpr).toBe(deviceScaleFactor);
        expect(unit).toBeGreaterThan(0);
        expect(Math.abs(unit * dpr - Math.round(unit * dpr))).toBeLessThan(1e-3);
        expect(Math.round(unit * dpr)).toBeGreaterThanOrEqual(1);
      });
    });
  }
});
