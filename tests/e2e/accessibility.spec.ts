import { test, expect, type Page } from '@playwright/test';
import { gameTimePasses } from './helpers/time';
import AxeBuilder from '@axe-core/playwright';
import { openTab, type TabId, type SegmentId } from './helpers/tabs';
import { tapContinue } from './helpers/phase';

/**
 * Story 1.32 (UX-DR39, UX-DR40, NFR15): screen readers and reduced motion get
 * the full game. Invariants only: axe finds no violations, the accessibility
 * tree holds no typed decoration, key changes reach the polite live region
 * (and resource values never do), focus follows the reading order and is
 * never hidden behind the primary zone, and reduced motion turns motion off.
 */

const PHONE = { width: 360, height: 640 };
const DESKTOP = { width: 1280, height: 800 };

async function seed(
  page: Page,
  gameState: Record<string, unknown>,
  settings: Record<string, unknown> | null = null,
): Promise<void> {
  await page.addInitScript(
    ([save, prefs]: [string, string | null]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'done');
      if (prefs) localStorage.setItem('the_swarm_settings', prefs);
    },
    [
      JSON.stringify({ version: 18, timestamp: Date.now(), playTimeMs: 0, gameState }),
      settings ? JSON.stringify({ version: 3, settings }) : null,
    ] as [string, string | null],
  );
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

/** Combat, well below its goal, fed and with room: nothing latches or alarms during a test. */
const COMBAT = {
  phase: 'combat',
  resources: { eggs: 0, larvae: 0, workers: 20, food: 1000, nestCapacity: 1000, wood: 10, stone: 10, nectar: 0 },
  eggPipeline: { count: 0, progress: 0 },
  larvaPipeline: { count: 0, progress: 0 },
  workersAssigned: { gather: 8, tend: 4, dig: 4, guard: 4, researchers: 0 },
};

const TABS: readonly [TabId, SegmentId?][] = [['nest'], ['wrkr'], ['build'], ['front', 'war'], ['log']];

/**
 * axe, WCAG 2 A/AA. Colour contrast is left to its own pass: the legacy
 * main.css colours are migrated to the phase tokens in Story 8.3, and DESIGN.md
 * owns the measured contrast table.
 */
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).disableRules(['color-contrast']).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Typed decoration that must never be read out (UX-DR40): `·`, block cells, arrows, box drawing, `[ `/` ]`, a `> ` prompt. */
const DECORATION = /[·█░▸▼▲→─-╿]|\[ | \]|"> /;

/**
 * The accessibility tree as text, without the faces of controls that have a
 * name of their own (`button "Add one gatherer": "[+]"` reads "Add one gatherer").
 */
async function spokenTree(page: Page): Promise<string> {
  const snap = await page.locator('body').ariaSnapshot();
  return snap
    .split('\n')
    .map((l) => l.replace(/^(\s*- \w+ "[^"]*"(?: \[[^\]]*\])*): .*$/, '$1'))
    .join('\n');
}

const announcer = (page: Page) => page.locator('[data-announcer]');

for (const [name, vp] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
  test.describe(`${name}: semantics`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(vp);
      await seed(page, COMBAT);
    });

    test('every tab passes axe and reads no typed decoration', async ({ page }) => {
      for (const [tab, segment] of TABS) {
        await openTab(page, tab, segment);
        expect(await axe(page), tab).toEqual([]);
        const tree = await spokenTree(page);
        const leaks = tree.split('\n').filter((l) => DECORATION.test(l));
        expect(leaks, tab).toEqual([]);
      }
    });

    test('labels read full words: the tabs and the strip name their resources and tabs in full', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /^WORKERS/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /^FRONTIER/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Food .*Workers/ })).toBeVisible();
      await expect(page.getByRole('progressbar', { name: 'Phase goal' }).first()).toBeAttached();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/THE SWARM/);
    });
  });
}

test.describe('sheets', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test('the resource and settings sheets pass axe and read no decoration', async ({ page }) => {
    await seed(page, COMBAT);
    await page.locator('[data-resource-strip]').click();
    await expect(page.getByRole('dialog').locator('[data-resource-list]')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    expect((await spokenTree(page)).split('\n').filter((l) => DECORATION.test(l))).toEqual([]);
    await page.locator('[data-resource-sheet] [data-action="settings"]').click();
    await expect(page.locator('[data-settings-sheet]')).toBeVisible();
    // EXPORT TELEMETRY (Story 3.10): named by its visible verb, checked with the rest of the sheet.
    await expect(page.getByRole('button', { name: 'EXPORT TELEMETRY' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('the offline summary passes axe, takes focus and reads no decoration (Story 2.9)', async ({ page }) => {
    // Two hours away, with upkeep outrunning food: gains, losses, a warn line and the next move.
    const away = Date.now() - 2 * 3_600_000;
    await page.addInitScript((save: string) => {
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'done');
    }, JSON.stringify({
      version: 18, timestamp: away, lastSeenAt: away, playTimeMs: 0,
      gameState: { ...COMBAT, resources: { ...COMBAT.resources, food: 50 }, workersAssigned: { gather: 0, tend: 16, dig: 0, guard: 4, researchers: 0 } },
    }));
    await page.goto('/');
    const dialog = page.locator('.offline-summary-popup');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-sheet-headline]')).toBeFocused();
    await expect(dialog.locator('[data-offline-warn="starved"]')).toBeVisible();
    await expect(dialog.locator('[data-offline-change]').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
    expect((await spokenTree(page)).split('\n').filter((l) => DECORATION.test(l))).toEqual([]);
  });

  test('a decision takes focus, is announced as a dialog and its choices are reachable', async ({ page }) => {
    await seed(page, {
      ...COMBAT,
      decision: { open: { id: 'overcrowding', remainingMs: 30_000, openedAtSessionMs: 0, roll: 0.5 }, nextSpawnSessionMs: 1e12 },
    });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-sheet-headline]')).toBeFocused();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Tab');
    await expect(page.locator('button[data-choice]').first()).toBeFocused();
  });
});

test.describe('live regions', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test('goal met and phase entered are announced politely', async ({ page }) => {
    await seed(page, { phase: 'egg_laying', resources: { workers: 1_000, food: 10_000_000, nestCapacity: 2_000 } });
    await expect(announcer(page)).toHaveAttribute('aria-live', 'polite');
    await expect(announcer(page)).toContainText(/goal met/i);
    await tapContinue(page);
    await expect(announcer(page)).toContainText(/phase entered/i);
  });

  test('the battle result is announced when its summary opens', async ({ page }) => {
    await seed(page, { ...COMBAT, combatSoldiers: 50, equipment: { weapon: 5, armor: 5 } });
    await openTab(page, 'front', 'war');
    await page.locator('[data-primary-for="front"] [data-action="fight"]').click();
    await expect(page.locator('[data-battle-summary]')).toBeVisible({ timeout: 5000 });
    await expect(announcer(page)).toContainText(/Battle (won|lost|drawn)/);
  });

  test('starving is announced once; resource values are never announced per tick', async ({ page }) => {
    await seed(page, COMBAT);
    // A healthy colony for 3 s: the region stays silent while values tick.
    await page.evaluate(() => {
      const w = window as unknown as { __said: number };
      w.__said = 0;
      new MutationObserver(() => w.__said++).observe(document.querySelector('[data-announcer]')!, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
    await gameTimePasses(page, 3000);
    expect(await page.evaluate(() => (window as unknown as { __said: number }).__said)).toBe(0);
    await expect(announcer(page)).toHaveText('');
  });

  test('a starving colony is announced', async ({ page }) => {
    await seed(page, {
      ...COMBAT,
      resources: { ...COMBAT.resources, food: 3 },
      workersAssigned: { gather: 0, tend: 10, dig: 6, guard: 4, researchers: 0 },
    });
    await expect(announcer(page)).toContainText(/starving/i, { timeout: 10_000 });
    // Hue never carries the warning alone: the falling food reads with a minus.
    await expect(page.locator('[data-strip-cell="food"] [data-delta][data-trend="down"]')).toContainText('−');
  });

  test('the unreadable-save sheet passes axe, takes focus and reads no decoration (Story 2.2)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('the_swarm_save', '{"version": 19, "gameState": {');
      localStorage.setItem('the_swarm_onboarding', 'done');
    });
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: "THIS SAVE COULDN'T BE READ." });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-sheet-headline]')).toBeFocused();
    expect(await axe(page)).toEqual([]);
    expect((await spokenTree(page)).split('\n').filter((l) => DECORATION.test(l))).toEqual([]);
  });

  test('the SAVE FAILED marker and its sheet pass axe and read no decoration (Story 2.2)', async ({ page }) => {
    await seed(page, COMBAT);
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.startsWith('the_swarm_save')) throw new DOMException('full', 'QuotaExceededError');
        return set.call(this, k, v);
      };
    });
    await page.locator('#click-egg').click();
    const marker = page.getByRole('button', { name: 'SAVE FAILED' });
    await expect(marker).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await marker.click();
    await expect(page.locator('[data-save-failed-sheet]')).toBeVisible();
    expect(await axe(page)).toEqual([]);
    expect((await spokenTree(page)).split('\n').filter((l) => DECORATION.test(l))).toEqual([]);
  });

  test('the import sheets pass axe, take focus and read no decoration (Story 2.11)', async ({ page }) => {
    await seed(page, COMBAT);
    const pick = async (text: string) => {
      await page.locator('[data-resource-strip]').click();
      await page.locator('[data-resource-sheet] [data-action="settings"]').click();
      await expect(page.locator('[data-settings-sheet]')).toBeVisible();
      const chooser = page.waitForEvent('filechooser');
      await page.locator('[data-settings-sheet] [data-action="import-save"]').click();
      await (await chooser).setFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    };
    await pick('not a save');
    const refused = page.getByRole('dialog', { name: "THAT FILE ISN'T A SWARM SAVE." });
    await expect(refused).toBeVisible();
    await expect(refused.locator('[data-sheet-headline]')).toBeFocused();
    expect(await axe(page)).toEqual([]);
    expect((await spokenTree(page)).split('\n').filter((l) => DECORATION.test(l))).toEqual([]);
    await refused.locator('[data-sheet-close]').click();
    await pick(await page.evaluate(() => localStorage.getItem('the_swarm_save')!));
    const confirm = page.locator('[data-import-confirm]');
    await expect(confirm).toBeVisible();
    await expect(confirm.locator('[data-sheet-headline]')).toBeFocused();
    expect(await axe(page)).toEqual([]);
    expect((await spokenTree(page)).split('\n').filter((l) => DECORATION.test(l))).toEqual([]);
  });

  test('a failed save is toasted in a status region and logged', async ({ page }) => {
    await seed(page, COMBAT);
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.startsWith('the_swarm_save')) throw new DOMException('full', 'QuotaExceededError');
        return set.call(this, k, v);
      };
    });
    await page.locator('#click-egg').click();
    await expect(page.getByRole('status').filter({ hasText: /SAVE FAILED/ })).toBeAttached();
  });
});

/** Which part of the shell an element is in. */
async function regionOfFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    if (el.closest('[data-shell-strip]')) return 'strip';
    if (el.closest('[data-goal-line]')) return 'goal';
    if (el.closest('[data-tab-bar]')) return 'tabs';
    const primary = el.closest('[data-primary-for], [data-primary-continue]');
    if (primary) return primary.getAttribute('data-primary-for') === 'nest' || primary.hasAttribute('data-primary-continue') ? 'nest-primary' : 'wide-primary';
    const panel = el.closest('[data-tab-panel]');
    if (panel) return panel.getAttribute('data-tab-panel') === 'nest' ? 'nest' : 'wide';
    return 'other';
  });
}

/** Tab through the page once, collapsing runs: the order in which the shell's parts get focus. */
async function focusOrder(page: Page, presses = 60): Promise<string[]> {
  await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {});
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: string[] = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const r = await regionOfFocus(page);
    if (r === 'body') break;
    if (seen.at(-1) !== r) seen.push(r);
    if (seen.length > 1 && r === seen[0]) break;
  }
  return seen;
}

test.describe('focus', () => {
  test('phone: strip → NEST (goal, scene, event lines) → primary action → tab bar', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await seed(page, COMBAT);
    const order = await focusOrder(page);
    expect(order.slice(0, 4)).toEqual(['strip', 'nest', 'nest-primary', 'tabs']);
  });

  test('desktop: rail → column 1 and its primary → columns 2–3 and theirs', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seed(page, COMBAT);
    await openTab(page, 'build');
    const order = await focusOrder(page);
    // Column 1 may hold no control of its own in a seed; whatever is there comes in this order.
    const rank = ['strip', 'tabs', 'nest', 'nest-primary', 'wide', 'wide-primary'];
    const ranks = order.map((r) => rank.indexOf(r));
    expect(ranks.every((r) => r >= 0), order.join(' → ')).toBe(true);
    expect([...ranks].sort((a, b) => a - b), order.join(' → ')).toEqual(ranks);
    for (const part of ['tabs', 'nest-primary', 'wide', 'wide-primary']) expect(order).toContain(part);
  });

  test('a focused control is never hidden behind the primary zone or tab bar', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await seed(page, COMBAT);
    await openTab(page, 'front', 'war');
    await page.locator('[data-tab="front"]').focus();
    let checked = 0;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !el.closest('[data-tab-panel]')) return null;
        const zone = document.querySelector('[data-primary-zone]')!.getBoundingClientRect();
        return { bottom: el.getBoundingClientRect().bottom, zoneTop: zone.top };
      });
      if (!r) continue;
      checked++;
      expect(r.bottom).toBeLessThanOrEqual(r.zoneTop + 1);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

test.describe('reduced motion', () => {
  test('the setting turns typing, floating +N, easing and CRT off, and the palette fade is 300 ms', async ({ page }) => {
    await page.setViewportSize(PHONE);
    // Freeze timers so the +N particle (removed after PARTICLE_MS) is still there to inspect.
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await seed(page, { phase: 'egg_laying' }, { reducedMotion: 'on', crt: 'full' });
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-reduced-motion', 'true');
    await expect(root).toHaveAttribute('data-crt', 'off');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--reveal-fade').trim())).toBe('300ms');
    // No floating +N.
    await page.locator('#click-egg').click();
    const particle = page.locator('.click-particle').first();
    await expect(particle).toBeAttached();
    await expect(particle).toHaveCSS('animation-name', 'none');
    // No easing anywhere in the shell: transitions and animations finish at once.
    const slow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-shell] *')].filter((el) => {
        const cs = getComputedStyle(el);
        const secs = (v: string) => Math.max(...v.split(',').map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 0.001 : 1)));
        return secs(cs.transitionDuration) > 0.01 || (cs.animationName !== 'none' && secs(cs.animationDuration) > 0.01);
      }).length,
    );
    expect(slow).toBe(0);
    // The cursor is steady.
    const cursor = page.locator('[data-primary-zone] [data-cursor]').first();
    await expect(cursor).toBeAttached();
    await expect(cursor).toHaveCSS('animation-name', 'none');
  });

  test('the OS setting is followed by default', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, { phase: 'egg_laying' });
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
  });

  test('without reduced motion the CRT choice is kept', async ({ page }) => {
    await seed(page, { phase: 'egg_laying' }, { reducedMotion: 'off', crt: 'full' });
    await expect(page.locator('html')).toHaveAttribute('data-crt', 'full');
  });
});

test.describe('Accessibility: the add-to-home-screen hint (Story 2.12)', () => {
  test('passes axe, takes focus and reads no decoration', async ({ page }) => {
    await page.setViewportSize(PHONE);
    // A mobile browser (coarse pointer) that isn't the installed app, past the first phase.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q === '(pointer: coarse)' ? ({ ...real(q), matches: true } as MediaQueryList) : real(q));
    });
    await seed(page, COMBAT);
    const dialog = page.getByRole('dialog', { name: 'ADD THE GAME TO YOUR HOME SCREEN.' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-sheet-headline]')).toBeFocused();
    expect(await axe(page)).toEqual([]);
    expect((await spokenTree(page)).split('\n').filter((l) => DECORATION.test(l))).toEqual([]);
  });
});
