import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openTab, type TabId, type SegmentId } from './helpers/tabs';
import { REVEAL, tapContinue } from './helpers/phase';

/**
 * E2E: every screen uses only the phase palette (Story 8.3, FR43).
 *
 * In each MVP phase (Egg Laying, Colony, Combat) every tab, segment and sheet
 * is opened, and every computed color of every element (and its ::before,
 * ::after and ::marker) must be one of that phase's tokens from tokens.css, or
 * the scrim, at any opacity, or fully transparent. A color left over from the
 * legacy stylesheets, or from another phase, fails. Colors are compared as RGB:
 * a token at a lower alpha (a glow, a 7% soil fill) is still that token.
 *
 * The cross-fade itself is covered by phase-transition.spec.ts; here the
 * Combat reveal is checked to be the first place an enemy creature is drawn.
 */

const TOKENS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/ui/styles/tokens.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function hexToRgb(hex: string): string {
  const h = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
}

/** The RGB triples a phase may draw with: its block in tokens.css, plus the scrim. */
function allowedRgb(token: string): string[] {
  const block = new RegExp(`:root\\[data-phase="${token}"\\]\\s*\\{([^}]*)\\}`).exec(TOKENS);
  if (!block) throw new Error(`no block for ${token}`);
  const hexes = [...block[1].matchAll(/--color-[a-z-]+\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase());
  const scrim = /--color-scrim\s*:\s*(#[0-9a-fA-F]{6})/.exec(TOKENS);
  if (!scrim) throw new Error('no scrim');
  return [...new Set([...hexes, scrim[1].toLowerCase()].map(hexToRgb))];
}

/**
 * Every computed color on the page that is not one of `allowed` (RGB triples)
 * and not fully transparent, as `selector · property · value`.
 */
async function strayColors(page: Page, allowed: string[]): Promise<string[]> {
  return page.evaluate((ok) => {
    const allow = new Set(ok);
    const PROPS = [
      'color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color',
      'border-left-color', 'outline-color', 'text-decoration-color', 'text-emphasis-color', 'column-rule-color',
      'caret-color', '-webkit-text-stroke-color', '-webkit-text-fill-color', 'box-shadow', 'text-shadow',
      'background-image', 'border-image-source',
    ];
    // Paint properties only paint on the SVG elements they apply to (every element computes a default).
    const SVG_PROPS = ['fill', 'stroke'];
    const SVG_ONLY: Record<string, string[]> = { stop: ['stop-color'], feflood: ['flood-color'], fedropshadow: ['flood-color'] };
    const COLOR = /rgba?\([^)]*\)|color\(srgb[^)]*\)|#[0-9a-f]{3,8}\b|(?:hsla?|hwb|lab|lch|oklab|oklch)\([^)]*\)/gi;
    const NAMED = /^(?:none|auto|normal|currentcolor|transparent|initial)$/i;
    /** `r,g,b` and alpha of a computed color, or null when it is not an sRGB color. */
    const parse = (c: string): { rgb: string; a: number } | null => {
      let m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(c);
      if (m) {
        const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
        return { rgb: [m[1], m[2], m[3]].map((x) => Math.round(Number(x))).join(','), a };
      }
      m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(c);
      if (m) {
        return {
          rgb: [m[1], m[2], m[3]].map((x) => Math.round(Number(x) * 255)).join(','),
          a: m[4] === undefined ? 1 : Number(m[4]),
        };
      }
      return null;
    };
    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
      const data = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 2).map((a) => `[${a.name}]`).join('');
      return `${el.tagName.toLowerCase()}${id}${cls}${data}`;
    };
    const out = new Set<string>();
    for (const el of document.querySelectorAll('*')) {
      // The tooling layers are not part of the game's look.
      if (el.closest('[data-debug-overlay], #debug-overlay, .debug-overlay')) continue;
      for (const pseudo of [null, '::before', '::after', '::marker']) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal') && pseudo !== '::marker') continue;
        if (pseudo === '::marker' && cs.display !== 'list-item' && getComputedStyle(el).display !== 'list-item') continue;
        const own = el instanceof SVGElement && !pseudo
          ? [...SVG_PROPS, ...(SVG_ONLY[el.tagName.toLowerCase()] ?? [])]
          : [];
        for (const prop of [...PROPS, ...own]) {
          const v = cs.getPropertyValue(prop).trim();
          if (!v || NAMED.test(v)) continue;
          for (const c of v.match(COLOR) ?? []) {
            const p = parse(c);
            if (p && (p.a === 0 || allow.has(p.rgb))) continue;
            out.add(`${describe(el)}${pseudo ?? ''} · ${prop} · ${c}`);
          }
        }
      }
    }
    return [...out];
  }, allowed);
}

const BASE = {
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
};

/** Each MVP phase, well below its goal and fed, so nothing latches or alarms during a test. */
const PHASES = {
  egg: {
    ...BASE,
    phase: 'egg_laying',
    resources: { eggs: 0, larvae: 0, workers: 2, food: 1_000, nestCapacity: 25, wood: 0, stone: 0, nectar: 0 },
  },
  colony: {
    ...BASE,
    phase: 'colony',
    resources: { eggs: 0, larvae: 0, workers: 12, food: 1_000, nestCapacity: 100, wood: 10, stone: 10, nectar: 0 },
    workersAssigned: { gather: 6, tend: 2, dig: 2, guard: 0, researchers: 0 },
  },
  combat: {
    ...BASE,
    phase: 'combat',
    resources: { eggs: 0, larvae: 0, workers: 20, food: 1_000, nestCapacity: 1_000, wood: 10, stone: 10, nectar: 0 },
    workersAssigned: { gather: 8, tend: 4, dig: 4, guard: 4, researchers: 0 },
    nextEnemy: 'beetle',
    combatSoldiers: 50,
    equipment: { weapon: 5, armor: 5 },
  },
} as const;

type PhaseKey = keyof typeof PHASES;

async function seed(page: Page, gameState: Record<string, unknown>, awayMs = 0): Promise<void> {
  await page.addInitScript(
    (save: string) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'done');
    },
    JSON.stringify({ version: 18, timestamp: Date.now() - awayMs, playTimeMs: 200_000, gameState }),
  );
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** The tabs and segments the phase shows, read from the tab bar itself. */
async function screens(page: Page): Promise<Array<[TabId, SegmentId?]>> {
  const bar = page.locator('[data-tab-bar]');
  if (!(await bar.isVisible())) return [['nest']];
  const tabs = (await bar.locator('[data-tab]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.tab))) as TabId[];
  const out: Array<[TabId, SegmentId?]> = [];
  for (const tab of tabs) {
    await openTab(page, tab);
    // A lone segment has no segment row: its tab is the screen.
    const segs = (await page
      .locator('[data-segment]')
      .evaluateAll((els) =>
        els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => (e as HTMLElement).dataset.segment),
      )) as SegmentId[];
    if (segs.length === 0) out.push([tab]);
    for (const s of segs) out.push([tab, s]);
  }
  return out;
}

async function auditEveryScreen(page: Page, token: PhaseKey): Promise<void> {
  const allowed = allowedRgb(token);
  await expect(page.locator('html')).toHaveAttribute('data-phase', token);
  const seen = await screens(page);
  expect(seen.length).toBeGreaterThan(0);
  for (const [tab, segment] of seen) {
    if (seen.length > 1 || segment) await openTab(page, tab, segment);
    expect(await strayColors(page, allowed), `${token} ${tab}${segment ? `/${segment}` : ''}`).toEqual([]);
  }

  // The resource sheet, and the settings screen it leads to.
  await page.locator('[data-resource-strip]').click();
  await expect(page.locator('[data-resource-sheet]')).toBeVisible();
  expect(await strayColors(page, allowed), `${token} resource sheet`).toEqual([]);
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await expect(page.locator('[data-settings-sheet]')).toBeVisible();
  expect(await strayColors(page, allowed), `${token} settings sheet`).toEqual([]);
}

for (const token of Object.keys(PHASES) as PhaseKey[]) {
  test.describe(`${token}: only the phase palette`, () => {
    test('every tab, segment and the resource and settings sheets', async ({ page }) => {
      await seed(page, PHASES[token]);
      await auditEveryScreen(page, token);
    });

    test('the offline summary and a decision sheet', async ({ page }) => {
      const allowed = allowedRgb(token);
      await seed(
        page,
        {
          ...PHASES[token],
          decision: {
            open: { id: 'cold_snap', remainingMs: 40_000, openedAtSessionMs: 0, roll: 0.5 },
            nextSpawnSessionMs: 0,
          },
        },
        120_000,
      );
      const offline = page.locator('.offline-summary-popup');
      await expect(offline).toBeVisible();
      expect(await strayColors(page, allowed), `${token} offline summary`).toEqual([]);
      await offline.locator('[data-sheet-close]').click();
      const decision = page.locator('#decision-popup');
      await expect(decision).toBeVisible();
      expect(await strayColors(page, allowed), `${token} decision sheet`).toEqual([]);
    });
  });
}

test('combat: the battle summary', async ({ page }) => {
  await seed(page, PHASES.combat);
  await openTab(page, 'front', 'war');
  await page.locator('[data-action="fight"]').click();
  const sheet = page.locator('[data-battle-summary]');
  await expect(sheet).toBeVisible({ timeout: 5_000 });
  expect(await strayColors(page, allowedRgb('combat')), 'battle summary').toEqual([]);
});

test.describe('the first enemy creature', () => {
  const enemy = (page: Page) => page.locator('[data-creature="enemy"]');

  test('is drawn in the Combat reveal, and nowhere before it', async ({ page }) => {
    // Colony with its goal met: every Colony screen is drawn first, then CONTINUE commits Combat.
    await seed(page, {
      ...PHASES.colony,
      resources: { ...PHASES.colony.resources, workers: 60, food: 5_000, nestCapacity: 200 },
      workersAssigned: { gather: 30, tend: 10, dig: 10, guard: 10, researchers: 0 },
      buildings: { barracks: { level: 1, count: 1 } },
    });
    for (const [tab, segment] of await screens(page)) {
      await openTab(page, tab, segment);
      await expect(enemy(page), `${tab} draws an enemy before Combat`).toHaveCount(0);
    }
    await tapContinue(page, 15_000, { reveal: 'keep' });
    const reveal = page.locator(REVEAL);
    await expect(reveal).toHaveAttribute('data-phase-reveal', 'combat');
    const drawn = reveal.locator('[data-creature="enemy"]');
    await expect(drawn).toBeVisible();
    // It is vector line-work in the phase color (DESIGN.md: the world is drawn, not typed), and decoration.
    await expect(drawn).toHaveAttribute('aria-hidden', 'true');
    expect(await drawn.evaluate((el) => el.tagName.toLowerCase())).toBe('svg');
    expect(await drawn.locator('path, ellipse, circle, line, polyline').count()).toBeGreaterThan(0);
  });

  test('is not drawn in the Colony reveal', async ({ page }) => {
    await seed(page, {
      ...PHASES.egg,
      resources: { ...PHASES.egg.resources, workers: 10, food: 200, nestCapacity: 50 },
    });
    await expect(enemy(page)).toHaveCount(0);
    await tapContinue(page, 15_000, { reveal: 'keep' });
    const reveal = page.locator(REVEAL);
    await expect(reveal).toHaveAttribute('data-phase-reveal', 'colony');
    await expect(enemy(page)).toHaveCount(0);
  });
});
