// @vitest-environment node
/**
 * Story 8.4 (UX-DR36; DESIGN.md → Elevation & Depth): CRT effects, off text by default.
 *
 * - SCENE: scanlines only on the scene surfaces (the vector scene and the
 *   full-screen overlays), drawn under their text; never on the strip, the tab
 *   bar or sheets. Line-work glows 3 px in the accent. Accent text of 15 px and
 *   larger gets a text-shadow of at most 2 px at no more than 35% opacity.
 * - FULL: scanlines over everything.
 * - OFF: no scanlines, no glow of any kind.
 * Scanlines are measured in `--crt-px`, a whole number of device pixels.
 * tests/e2e/crt.spec.ts checks the rendered result.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SRC = join(ROOT, 'src');
const CRT_CSS = join(SRC, 'ui/styles/crt.css');

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function filesUnder(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return filesUnder(p, ext);
    return name.endsWith(ext) ? [p] : [];
  });
}

interface Rule {
  file: string;
  selector: string;
  body: string;
}
function rules(files: string[]): Rule[] {
  return files.flatMap((file) =>
    [...strip(readFileSync(file, 'utf8')).matchAll(/([^{}]+){([^{}]*)}/g)].map((m) => ({
      file: relative(ROOT, file),
      selector: m[1].trim().replace(/\s+/g, ' '),
      body: m[2],
    })),
  );
}
const decl = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1].trim();

const CSS_FILES = filesUnder(SRC, '.css');
const ALL = rules(CSS_FILES);
const CRT = rules([CRT_CSS]);
const rootVar = (name: string, selector = ':root') =>
  CRT.find((r) => r.selector === selector && decl(r.body, name) !== undefined)?.body &&
  decl(CRT.find((r) => r.selector === selector && decl(r.body, name) !== undefined)!.body, name);

describe('CRT effects (Story 8.4)', () => {
  it('text glow is at most 2 px at no more than 35% of the accent', () => {
    const glow = rootVar('--crt-text-glow')!;
    expect(glow).toBeDefined();
    const lengths = [...glow.replace(/color-mix\([^)]*\)/g, '').matchAll(/(-?[\d.]+)px/g)].map((m) => Math.abs(Number(m[1])));
    expect(lengths.length).toBeGreaterThan(0);
    for (const px of lengths) expect(px).toBeLessThanOrEqual(2);
    const mix = glow.match(/color-mix\(in srgb,\s*var\(--color-accent\)\s*([\d.]+)%,\s*transparent\)/);
    expect(mix, glow).not.toBeNull();
    expect(Number(mix![1])).toBeLessThanOrEqual(35);
  });

  it('line-work glow is a 3 px accent drop-shadow', () => {
    expect(rootVar('--crt-line-glow')).toMatch(/^drop-shadow\(0 0 3px var\(--color-accent\)\)$/);
  });

  it('OFF turns both glows off', () => {
    expect(rootVar('--crt-text-glow', ':root[data-crt="off"]')).toBe('none');
    expect(rootVar('--crt-line-glow', ':root[data-crt="off"]')).toBe('none');
  });

  it('every text glow in the styles is the CRT text glow, so OFF and the 2 px / 35% limit reach it', () => {
    const offenders = ALL.filter((r) => {
      const v = decl(r.body, 'text-shadow');
      return v !== undefined && v !== 'none' && v !== 'var(--crt-text-glow)' && !/!important/.test(v);
    }).map((r) => `${r.file}: ${r.selector}`);
    expect(offenders).toEqual([]);
  });

  /**
   * Accent rules that are containers, not text: text-shadow is inherited, so a
   * glow there would reach the smaller text inside. Each needs a reason.
   */
  const CONTAINERS = new Set([
    // The sheet body holds rows of every size (labels, notes at `meta`).
    '.sheet__body',
  ]);

  it('accent text of 15 px and larger carries the text glow', () => {
    const big = /var\(--type-(?:value|title|display)\)/;
    const offenders = ALL.filter(
      (r) =>
        !CONTAINERS.has(r.selector) &&
        decl(r.body, 'color') === 'var(--color-accent)' &&
        big.test(decl(r.body, 'font-size') ?? '') &&
        decl(r.body, 'text-shadow') !== 'var(--crt-text-glow)',
    ).map((r) => `${r.file}: ${r.selector}`);
    expect(offenders).toEqual([]);
  });

  it('only line-work takes a filter, and it is the line glow', () => {
    const offenders = ALL.filter((r) => {
      const v = decl(r.body, 'filter');
      return v !== undefined && v !== 'none' && v !== 'var(--crt-line-glow)';
    }).map((r) => `${r.file}: ${r.selector}`);
    expect(offenders).toEqual([]);
    expect(ALL.some((r) => /\[data-line-work\]/.test(r.selector) && decl(r.body, 'filter') === 'var(--crt-line-glow)')).toBe(true);
  });

  it('scanlines are drawn only on scene surfaces in SCENE and over everything in FULL', () => {
    const users = ALL.filter((r) => /var\(--crt-scanlines\)/.test(r.body));
    expect(users.length).toBeGreaterThan(0);
    for (const r of users) {
      const scene = /^:root\[data-crt="scene"\] \[data-crt-surface\]::after$/.test(r.selector);
      const full = /^:root\[data-crt="full"\] body::after$/.test(r.selector);
      expect(scene || full, `${r.file}: ${r.selector}`).toBe(true);
    }
  });

  it('keeps text above the scanlines on a scene surface', () => {
    const lines = CRT.find((r) => r.selector === ':root[data-crt="scene"] [data-crt-surface]::after')!;
    const text = CRT.find((r) => r.selector.startsWith(':root[data-crt="scene"] [data-crt-surface] > :not('))!;
    expect(text, 'a rule lifting the surface text above the scanlines').toBeDefined();
    expect(Number(decl(text.body, 'z-index'))).toBeGreaterThan(Number(decl(lines.body, 'z-index')));
    expect(decl(lines.body, 'pointer-events')).toBe('none');
  });

  it('measures the scanlines in device pixels (--crt-px)', () => {
    const lines = rootVar('--crt-scanlines')!;
    const lengths = [...lines.matchAll(/(?<![\w-])([\d.]+)px/g)];
    expect(lengths, 'no bare CSS px in the scanline pattern').toEqual([]);
    expect(lines).toMatch(/var\(--crt-px\)/);
  });

  it('OFF removes every shadow, so no glow is left anywhere', () => {
    const off = CRT.find((r) => r.selector.startsWith(':root[data-crt="off"] body *'));
    expect(off).toBeDefined();
    expect(decl(off!.body, 'text-shadow')).toBe('none !important');
    expect(decl(off!.body, 'box-shadow')).toBe('none !important');
  });

  it('the strip, the tab bar and sheets are never scene surfaces', () => {
    const offenders = filesUnder(join(SRC, 'ui'), '.tsx')
      .filter((f) => /[/\\](shell|sheets)[/\\]/.test(f))
      .filter((f) => readFileSync(f, 'utf8').includes('data-crt-surface'))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
    const surfaces = filesUnder(join(SRC, 'ui'), '.tsx').filter((f) => readFileSync(f, 'utf8').includes('data-crt-surface'));
    expect(surfaces.length).toBeGreaterThan(0);
  });
});
