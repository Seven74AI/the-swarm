// @vitest-environment node
/**
 * Story 8.3 (FR43): every screen uses only the phase palette.
 *
 * tokens.css is the one place a color is written down. Every other stylesheet
 * under src/ (the legacy main.css included) uses the runtime aliases
 * (`var(--color-*)`), so nothing is left over from the legacy earth-tone theme
 * and no phase hard-codes a color of its own. tests/e2e/palette.spec.ts checks
 * the computed colors of every screen in the browser.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SRC = join(ROOT, 'src');
const TOKENS_CSS = join(SRC, 'ui/styles/tokens.css');

function cssFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return cssFilesUnder(p);
    return name.endsWith('.css') ? [p] : [];
  });
}

/** `property: value` declarations of a stylesheet, comments removed. */
function declarations(css: string): Array<{ prop: string; value: string }> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<{ prop: string; value: string }> = [];
  for (const block of text.matchAll(/\{([^{}]*)\}/g)) {
    for (const d of block[1].matchAll(/([-a-z]+)\s*:\s*([^;]+)/gi)) out.push({ prop: d[1], value: d[2].trim() });
  }
  return out;
}

const NAMED = /\b(?:white|black|red|green|blue|yellow|orange|gold|gray|grey|silver|purple|cyan|magenta|pink|brown|navy|teal|lime|maroon|olive)\b/i;
const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

describe('only the phase palette (Story 8.3)', () => {
  const files = cssFilesUnder(SRC).filter((f) => f !== TOKENS_CSS);

  it('finds the stylesheets, the legacy main.css among them', () => {
    expect(files.map((f) => relative(SRC, f))).toContain('main.css');
  });

  it('no stylesheet but tokens.css writes a color: they use the var(--color-*) aliases', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const { prop, value } of declarations(readFileSync(file, 'utf8'))) {
        if (prop === 'content' || prop === 'font-family' || prop.startsWith('--anim') || prop === 'animation') continue;
        if (LITERAL.test(value) || NAMED.test(value)) offenders.push(`${relative(ROOT, file)}: ${prop}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('declares no color property but the aliases: no legacy palette variables, no per-phase overrides', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/@property\s+(--[a-z-]+)\s*\{[^}]*syntax:\s*'<color>'/g)) {
        if (!m[1].startsWith('--color-')) offenders.push(`${relative(ROOT, file)}: @property ${m[1]}`);
      }
      for (const m of css.matchAll(/var\((--[a-z-]+)/g)) {
        if (/^--(?:bg|text|accent|border|success|danger)\b/.test(m[1])) offenders.push(`${relative(ROOT, file)}: var(${m[1]})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no script paints the DOM with a color literal either (inline styles take the aliases too)', () => {
    const offenders: string[] = [];
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : name.endsWith('.tsx') ? [p] : [];
      });
    for (const file of walk(join(SRC, 'ui'))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?:fill|stroke|color|background)\s*[=:]\s*["'{]\s*["']?(#[0-9a-f]{3,8}\b|rgba?\()/gi)) {
        offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
