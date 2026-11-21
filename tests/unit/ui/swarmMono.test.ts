// @vitest-environment node
/**
 * Story 8.1 (UX-DR2): the game ships its own monospace font, "Swarm Mono", so
 * meters, boxes and symbols line up on every phone. Invariants: both weights
 * exist as WOFF2 with their licence, cover the terminal character set at one
 * advance width, stay small, and system monospace is only the fallback.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readWoff2 } from '../helpers/woff2';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const FONTS = join(ROOT, 'public/fonts');
const FILES = { regular: 'SwarmMono-Regular.woff2', bold: 'SwarmMono-Bold.woff2' } as const;
/** "Well under 50 KB" for both files together (DESIGN.md → Typography). */
const BUDGET_BYTES = 50 * 1024;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const REQUIRED: readonly number[] = [
  ...range(0x20, 0x7e), // ASCII
  ...range(0x2500, 0x257f), // box drawing
  ...range(0x2580, 0x259f), // block elements
  ...[...'·−×✓✗▲▼•█░▒▓'].map((c) => c.codePointAt(0)!),
];

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

describe('Swarm Mono font files', () => {
  for (const [name, file] of Object.entries(FILES)) {
    describe(name, () => {
      const path = join(FONTS, file);

      it('is a WOFF2 file of the right weight', () => {
        expect(existsSync(path)).toBe(true);
        const font = readWoff2(readFileSync(path));
        expect(font.weight).toBe(name === 'bold' ? 700 : 400);
      });

      it('covers ASCII, box drawing, block elements and the terminal symbols', () => {
        const font = readWoff2(readFileSync(path));
        expect(REQUIRED.filter((cp) => font.advance(cp) === undefined).map(hex)).toEqual([]);
      });

      it('draws every one of those characters at the same advance width', () => {
        const font = readWoff2(readFileSync(path));
        const widths = new Set(REQUIRED.map((cp) => font.advance(cp)));
        expect([...widths]).toHaveLength(1);
      });
    });
  }

  it('totals well under 50 KB', () => {
    const total = Object.values(FILES).reduce((sum, f) => sum + statSync(join(FONTS, f)).size, 0);
    expect(total).toBeLessThan(BUDGET_BYTES);
  });

  it('ships the SIL Open Font License beside the files', () => {
    const licence = readFileSync(join(FONTS, 'OFL.txt'), 'utf8');
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(licence).toMatch(/Copyright/);
  });
});

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const STYLESHEETS = cssFiles(join(ROOT, 'src'));

describe('Swarm Mono in the styles', () => {
  const faces = STYLESHEETS.flatMap((f) => [...strip(readFileSync(f, 'utf8')).matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]));

  it('declares a face for each weight from the shipped files', () => {
    for (const [name, file] of Object.entries(FILES)) {
      const face = faces.find((f) => f.includes(file));
      expect(face, file).toBeDefined();
      expect(face).toMatch(/font-family\s*:\s*["']Swarm Mono["']/);
      expect(face).toMatch(new RegExp(`font-weight\\s*:\\s*${name === 'bold' ? 700 : 400}\\b`));
      expect(face).toMatch(/format\(\s*["']woff2["']\s*\)/);
    }
  });

  it('names Swarm Mono first in every font stack: system monospace is only the fallback', () => {
    const offenders: string[] = [];
    for (const file of STYLESHEETS) {
      const css = strip(readFileSync(file, 'utf8')).replace(/@font-face\s*{[^}]*}/g, '');
      for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
        const value = m[1].trim();
        if (value === 'inherit' || value === 'var(--font-mono)') continue;
        offenders.push(`${relative(ROOT, file)}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
    const stack = STYLESHEETS.map((f) => strip(readFileSync(f, 'utf8')))
      .join('\n')
      .match(/--font-mono\s*:\s*([^;]+);/)?.[1];
    expect(stack).toBeDefined();
    const families = stack!.split(',').map((s) => s.trim());
    expect(families[0]).toMatch(/^["']Swarm Mono["']$/);
    expect(families.at(-1)).toBe('monospace');
  });

  it('preloads both weights from the page', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    for (const file of Object.values(FILES)) {
      const link = [...html.matchAll(/<link[^>]+>/g)].map((m) => m[0]).find((l) => l.includes(file));
      expect(link, file).toBeDefined();
      expect(link).toMatch(/rel="preload"/);
      expect(link).toMatch(/as="font"/);
      expect(link).toMatch(/crossorigin/);
    }
  });
});
