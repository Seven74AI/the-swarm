// @vitest-environment node
/**
 * Story 1.31 (NFR7, UX-DR5): text follows the player's text size. Zoom is
 * never disabled, the root font size is not pinned in px, and every
 * stylesheet sets font sizes in rem/em (or relative keywords), never px.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

const STYLESHEETS = [...cssFiles(join(ROOT, 'src')), join(ROOT, 'index.html')];
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('text sizes follow the player', () => {
  it('never disables zoom', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const viewport = html.match(/<meta[^>]+name="viewport"[^>]*>/)?.[0] ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it('sets no font size in px', () => {
    const offenders: string[] = [];
    for (const file of STYLESHEETS) {
      const css = strip(readFileSync(file, 'utf8'));
      for (const m of css.matchAll(/font(?:-size)?\s*:[^;{}]*?\b\d*\.?\d+px/g)) {
        offenders.push(`${relative(ROOT, file)}: ${m[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
