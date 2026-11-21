// @vitest-environment node
/**
 * Phase design tokens (Story 1.8, UX-DR1).
 *
 * - `ui/styles/tokens.css` holds the 6 phase palettes of DESIGN.md's front
 *   matter (7 values each) plus `scrim`, and binds the runtime aliases
 *   (`--color-accent`, …) per phase on `:root[data-phase=…]`.
 * - A phase's colors exist only inside that phase's block, so no later
 *   palette is reachable before its phase is entered.
 * - No other stylesheet under `ui/` names a phase hex: components use aliases.
 * - DESIGN.md's contrast table is recomputed from the tokens.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PHASE_TOKEN,
  PALETTE_KEYS,
  ALIAS_PROPERTIES,
} from '../../src/ui/theme/phaseTheme';
import { PHASE_ORDER } from '../../src/phases/phases';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const UI = join(ROOT, 'src/ui');
const TOKENS_CSS = join(UI, 'styles/tokens.css');
const DESIGN_MD = join(ROOT, '_bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/DESIGN.md');

const design = readFileSync(DESIGN_MD, 'utf8');
const css = readFileSync(TOKENS_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** `colors:` entries of the DESIGN.md front matter that are literal hexes. */
function designColors(): Record<string, string> {
  const front = design.split(/^---$/m)[1];
  const block = front.slice(front.indexOf('\ncolors:'), front.indexOf('\ntypography:'));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/^\s+([a-z-]+):\s*'(#[0-9a-fA-F]{6,8})'/gm)) out[m[1]] = m[2].toLowerCase();
  return out;
}

/** Custom properties declared in each rule block of tokens.css, by selector. */
function cssBlocks(): Array<{ selector: string; props: Record<string, string> }> {
  const blocks: Array<{ selector: string; props: Record<string, string> }> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const props: Record<string, string> = {};
    for (const d of m[2].matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) props[d[1]] = d[2].trim().toLowerCase();
    blocks.push({ selector: m[1].trim().replace(/\s+/g, ' '), props });
  }
  return blocks;
}

/** The aliases as bound while `phase` (a DESIGN.md palette name) is active. */
function aliasesFor(token: string): Record<string, string> {
  const blocks = cssBlocks().filter((b) => b.selector.split(',').some((s) => s.trim() === `:root[data-phase="${token}"]`));
  expect(blocks, `one block for :root[data-phase="${token}"]`).toHaveLength(1);
  return blocks[0].props;
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function cssFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return cssFilesUnder(p);
    return name.endsWith('.css') ? [p] : [];
  });
}

function normalizeHex(h: string): string {
  const x = h.toLowerCase();
  return x.length === 4 || x.length === 5 ? '#' + x.slice(1).split('').map((c) => c + c).join('') : x;
}

const colors = designColors();
const tokens = PHASE_ORDER.map((p) => PHASE_TOKEN[p]);

describe('phase tokens (Story 1.8)', () => {
  it('maps every phase to a DESIGN.md palette with all 7 values', () => {
    expect(new Set(tokens).size).toBe(PHASE_ORDER.length);
    for (const t of tokens) {
      for (const k of PALETTE_KEYS) expect(colors[`${t}-${k}`], `${t}-${k} in DESIGN.md`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('binds every alias in each phase block to that phase palette from DESIGN.md', () => {
    for (const t of tokens) {
      const props = aliasesFor(t);
      for (const k of PALETTE_KEYS) expect(props[`--color-${k}`], `${t} --color-${k}`).toBe(colors[`${t}-${k}`]);
      // on-accent is the phase background (inverse video).
      expect(props['--color-on-accent']).toBe(colors[`${t}-bg`]);
      expect(Object.keys(props).sort()).toEqual([...ALIAS_PROPERTIES].sort());
    }
  });

  it('defines scrim once, outside the phase blocks', () => {
    const scrims = cssBlocks().filter((b) => '--color-scrim' in b.props);
    expect(scrims).toHaveLength(1);
    expect(scrims[0].selector).not.toContain('data-phase');
    expect(scrims[0].props['--color-scrim']).toBe(colors.scrim);
  });

  it('keeps each phase color inside its own phase block (no later palette is reachable early)', () => {
    for (const b of cssBlocks()) {
      const owners = tokens.filter((t) => b.selector.includes(`data-phase="${t}"`));
      const values = new Set(Object.values(b.props).flatMap((v) => v.match(/#[0-9a-f]{3,8}\b/g) ?? []));
      for (const t of tokens) {
        if (owners.includes(t)) continue;
        for (const k of PALETTE_KEYS) {
          const hex = colors[`${t}-${k}`];
          // A value shared with an owning phase's palette is that phase's own color.
          if (owners.some((o) => PALETTE_KEYS.some((ok) => colors[`${o}-${ok}`] === hex))) continue;
          expect(values.has(hex), `${hex} (${t}-${k}) leaks into "${b.selector}"`).toBe(false);
        }
      }
    }
  });

  it('binds the first phase palette when no phase attribute is set yet', () => {
    const first = PHASE_TOKEN[PHASE_ORDER[0]];
    const selectors = (b: { selector: string }) => b.selector.split(',').map((s) => s.trim());
    const block = cssBlocks().find((b) => selectors(b).includes(':root') && '--color-accent' in b.props);
    expect(block, 'a bare :root block binding the aliases by default').toBeDefined();
    expect(selectors(block!)).toContain(`:root[data-phase="${first}"]`);
  });

  it('no other ui/ stylesheet references a phase hex directly', () => {
    const phaseHexes = new Set(
      Object.entries(colors)
        .filter(([k]) => tokens.some((t) => k.startsWith(`${t}-`)) || k === 'scrim')
        .map(([, v]) => v),
    );
    const offenders: string[] = [];
    for (const file of cssFilesUnder(UI)) {
      if (file === TOKENS_CSS) continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (phaseHexes.has(normalizeHex(m[0]))) offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  describe('DESIGN.md contrast table', () => {
    const rows = [...design.matchAll(/^\|([^|\n]+)\|([^|\n]+)\|\s*$/gm)]
      .map((m) => ({ pair: m[1], range: m[2] }))
      .filter((r) => /`[a-z-]+`[^`]*\/\s*`[a-z-]+`/.test(r.pair))
      .map((r) => {
        const [fg, bg] = [...r.pair.matchAll(/`([a-z-]+)`/g)].map((x) => x[1]);
        const min = Number(/(\d+(?:\.\d+)?)/.exec(r.range)![1]);
        return { fg, bg, min, label: r.pair.trim() };
      });

    it('is found and covers the stated pairs', () => {
      expect(rows.length).toBeGreaterThanOrEqual(8);
      const pairs = rows.map((r) => `${r.fg}/${r.bg}`);
      for (const p of ['accent/bg', 'dim/raised', 'edge/bg']) expect(pairs).toContain(p);
    });

    it('holds in every phase, recomputed from the tokens', () => {
      const failures: string[] = [];
      for (const t of tokens) {
        const props = aliasesFor(t);
        for (const r of rows) {
          const ratio = contrast(props[`--color-${r.fg}`], props[`--color-${r.bg}`]);
          if (ratio < r.min) failures.push(`${t}: ${r.label} = ${ratio.toFixed(2)} < ${r.min}`);
        }
      }
      expect(failures).toEqual([]);
    });
  });
});
