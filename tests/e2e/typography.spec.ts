import { test, expect, type Page } from '@playwright/test';
import { openTab, type TabId, type SegmentId } from './helpers/tabs';
import { seedSave } from './helpers/seed';
import { TITLE_BEATS } from '../../src/data/content/titleCinematic';

/**
 * Story 8.1 (UX-DR2): the game draws in its own monospace font, so the
 * terminal grid lines up the same on every phone, and the rendered text keeps
 * the type rules: nothing below 12 px, sentence-case text at 13 px or more,
 * text glow only at 15 px or more. Invariants only, at the default text size.
 */

const PHONE = { width: 360, height: 640 };
const MIN_TEXT_PX = 12;
const MIN_SENTENCE_PX = 13;
const MIN_GLOW_PX = 15;

/** Combat, well below its goal, fed and with room: every tab has content and nothing latches. */
const COMBAT = {
  phase: 'combat',
  resources: { eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 1000, wood: 10, stone: 10, nectar: 0 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 8, tend: 4, dig: 4, guard: 4, researchers: 0 },
  nextEnemy: 'beetle',
};

const TABS: readonly [TabId, SegmentId?][] = [['nest'], ['wrkr'], ['build'], ['front', 'war'], ['log']];

async function seed(page: Page, gameState: Record<string, unknown>): Promise<void> {
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'done');
  }, JSON.stringify({ version: 18, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/**
 * Every visible text run that breaks a type rule, as "rule: text (size px)".
 * The hold ring's block cells are a drawing, not text (see typeRoles.test.ts).
 */
async function typeRuleBreaks(page: Page): Promise<string[]> {
  return page.evaluate(
    ([minText, minSentence, minGlow]) => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? '';
        const el = node.parentElement;
        if (!text || !el || el.closest('.swarm-confirm__ring')) continue;
        if (el.closest('.visually-hidden')) continue;
        const rects = Array.from(el.getClientRects());
        if (!rects.some((r) => r.width > 0 && r.height > 0)) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const px = parseFloat(style.fontSize);
        const shown = style.textTransform === 'uppercase' ? text.toUpperCase() : text;
        if (px < minText) out.push(`below ${minText} px: ${text} (${px})`);
        if (/[a-z]/.test(shown) && px < minSentence) out.push(`sentence case below ${minSentence} px: ${text} (${px})`);
        if (style.textShadow !== 'none' && px < minGlow) out.push(`glow below ${minGlow} px: ${text} (${px})`);
      }
      return out;
    },
    [MIN_TEXT_PX, MIN_SENTENCE_PX, MIN_GLOW_PX] as const,
  );
}

test.describe('Swarm Mono', () => {
  test('the page draws in Swarm Mono, both weights load, and system monospace is only the fallback', async ({ page }) => {
    await seed(page, COMBAT);
    const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const families = body.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    expect(families[0]).toBe('Swarm Mono');
    expect(families.at(-1)).toBe('monospace');
    const loaded = await page.evaluate(async () => {
      await Promise.all([document.fonts.load('400 1rem "Swarm Mono"', '█'), document.fonts.load('700 1rem "Swarm Mono"', '█')]);
      return [...document.fonts]
        .filter((f) => f.family.replace(/["']/g, '') === 'Swarm Mono' && f.status === 'loaded')
        .map((f) => f.weight)
        .sort();
    });
    expect(loaded).toEqual(['400', '700']);
  });

  test('letters, box drawing, blocks and symbols take the same width on screen', async ({ page }) => {
    await seed(page, COMBAT);
    const widths = await page.evaluate(async () => {
      await document.fonts.load('400 1rem "Swarm Mono"', 'M█');
      const chars = ['M', 'i', '0', '─', '═', '┼', '█', '░', '▒', '▓', '·', '−', '×', '✓', '✗', '▲', '▼', '•'];
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:0;top:0;white-space:pre;font-family:"Swarm Mono";font-size:2rem';
      document.body.append(host);
      const out = Object.fromEntries(
        chars.map((c) => {
          const span = document.createElement('span');
          span.textContent = c.repeat(20);
          host.append(span);
          return [c, Math.round(span.getBoundingClientRect().width * 100) / 100];
        }),
      );
      host.remove();
      return out;
    });
    expect(new Set(Object.values(widths)).size, JSON.stringify(widths)).toBe(1);
  });
});

test('the first screen keeps the type rules', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await seed(page, { phase: 'egg_laying', resources: { eggs: 3, workers: 0, food: 50, nestCapacity: 50 } });
  await expect(page.locator('[data-nest-primary="lay"]')).toBeVisible();
  expect(await typeRuleBreaks(page)).toEqual([]);
});

test('the title cinematic keeps the type rules, every stage (Story 8.10)', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  // A first launch: no save, no intro flag.
  await seedSave(page, null, { introSeen: false });
  await page.goto('/');
  const cinematic = page.locator('[data-overlay="title-cinematic"]');
  await expect(cinematic).toHaveAttribute('data-stage', 'playing');
  await page.clock.runFor(TITLE_BEATS.eggMs);
  await expect(page.locator('[data-title-line]')).not.toBeEmpty();
  expect.soft(await typeRuleBreaks(page), 'playing').toEqual([]);
  await page.keyboard.press('Escape');
  await expect(cinematic).toHaveAttribute('data-stage', 'title');
  expect.soft(await typeRuleBreaks(page), 'title frame').toEqual([]);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-title-alone]')).toBeVisible();
  expect(await typeRuleBreaks(page), 'alone').toEqual([]);
});

test.describe('type rules on screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
    await seed(page, COMBAT);
  });

  test('every tab keeps the type rules', async ({ page }) => {
    for (const [tab, segment] of TABS) {
      await openTab(page, tab, segment);
      expect.soft(await typeRuleBreaks(page), tab).toEqual([]);
    }
  });

  test('the nest scene\'s chamber labels and peek sheets keep the type rules (Story 8.5)', async ({ page }) => {
    for (const chamber of ['brood', 'workers']) {
      await page.locator(`[data-scene="nest"] button[data-chamber="${chamber}"]`).click();
      await expect(page.locator(`[data-chamber-peek="${chamber}"]`)).toBeVisible();
      expect.soft(await typeRuleBreaks(page), chamber).toEqual([]);
    }
  });

  test('the resource and settings sheets keep the type rules', async ({ page }) => {
    await page.locator('[data-resource-strip]').click();
    await expect(page.getByRole('dialog').locator('[data-resource-list]')).toBeVisible();
    expect.soft(await typeRuleBreaks(page), 'resources').toEqual([]);
    await page.locator('[data-resource-sheet] [data-action="settings"]').click();
    await expect(page.locator('[data-settings-sheet]')).toBeVisible();
    expect(await typeRuleBreaks(page), 'settings').toEqual([]);
  });
});
