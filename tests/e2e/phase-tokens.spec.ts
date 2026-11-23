import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tapContinue } from './helpers/phase';
import { goalTarget } from './helpers/guards';

/**
 * E2E: phase design tokens (Story 1.8).
 * The root carries one `data-phase` attribute; the color aliases resolve to
 * the active phase's palette, and later palettes are not reachable early.
 */

const TOKENS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/ui/styles/tokens.css'),
  'utf8',
);
const ALIASES = ['bg', 'raised', 'line', 'edge', 'dim', 'accent', 'warn', 'on-accent'].map((k) => `--color-${k}`);

/** Alias values a phase block of tokens.css declares. */
function palette(token: string): Record<string, string> {
  const block = new RegExp(`:root\\[data-phase="${token}"\\]\\s*\\{([^}]*)\\}`).exec(TOKENS);
  if (!block) throw new Error(`no block for ${token}`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/(--color-[a-z-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().toLowerCase();
  return out;
}

async function boundAliases(page: Page): Promise<Record<string, string>> {
  return page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    // The aliases are registered colors (Story 1.20's cross-fade), so they compute to rgb(): compare as hex.
    const hex = (v: string): string => {
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(v);
      if (!m) return v;
      const parts = [m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, '0'));
      if (m[4] !== undefined && Number(m[4]) < 1) parts.push(Math.round(Number(m[4]) * 255).toString(16).padStart(2, '0'));
      return `#${parts.join('')}`;
    };
    return Object.fromEntries(names.map((n) => [n, hex(cs.getPropertyValue(n).trim().toLowerCase())]));
  }, ALIASES);
}

const LATER_THAN_EGG = ['colony', 'combat', 'expansion', 'space', 'transcendence'];

test.describe('Phase tokens', () => {
  test('a new game binds the egg palette and no later palette', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-phase', 'egg');
    const bound = await boundAliases(page);
    expect(bound).toEqual(palette('egg'));

    const egg = new Set(Object.values(palette('egg')));
    const bindings = new Set(Object.values(bound));
    for (const t of LATER_THAN_EGG) {
      for (const hex of Object.values(palette(t))) {
        if (egg.has(hex)) continue;
        expect(bindings.has(hex), `${t} ${hex} reachable in egg phase`).toBe(false);
      }
    }
  });

  test('entering Colony rebinds the aliases through the root attribute alone', async ({ page }) => {
    await page.addInitScript((target: number) => {
      localStorage.setItem(
        'the_swarm_save',
        JSON.stringify({
          version: 14,
          timestamp: Date.now(),
          playTimeMs: 0,
          gameState: { phase: 'egg_laying', resources: { workers: target, food: 200, nestCapacity: 50 } },
        }),
      );
    }, goalTarget('egg_laying', 'workers'));
    await page.goto('/');
    // The goal is met; Colony is entered on CONTINUE (Story 1.19).
    await expect(page.locator('html')).toHaveAttribute('data-phase', 'egg');
    await tapContinue(page);
    await expect(page.locator('html')).toHaveAttribute('data-phase', 'colony');
    expect(await boundAliases(page)).toEqual(palette('colony'));
    // The aliases are not set inline: only the attribute moved.
    expect(await page.evaluate(() => document.documentElement.getAttribute('style'))).toBeNull();
  });
});
