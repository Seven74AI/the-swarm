// @vitest-environment node
/**
 * Story 8.1 (UX-DR2): six type roles (display, title, value, body, aside,
 * meta), written in rem so the player's text size applies. Every font size in
 * the styles is one of the roles, none is below 12 px at the default text size,
 * and text glow (text-shadow) only sits on roles of 15 px and above.
 * tests/e2e/typography.spec.ts checks the rendered text (sentence case ≥ 13 px).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** The browser's default text size, against which DESIGN.md's px sizes are written. */
const DEFAULT_PX = 16;
const MIN_TEXT_PX = 12;
const MIN_GLOW_PX = 15;

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const STYLESHEETS = cssFiles(join(ROOT, 'src'));
const ALL_CSS = STYLESHEETS.map((f) => strip(readFileSync(f, 'utf8'))).join('\n');

const ROLES = ['display', 'title', 'value', 'body', 'aside', 'meta'] as const;
type Role = (typeof ROLES)[number];

function roleRem(role: Role): number | undefined {
  const m = ALL_CSS.match(new RegExp(`--type-${role}\\s*:\\s*([\\d.]+)rem\\s*;`));
  return m ? Number(m[1]) : undefined;
}

/**
 * Font sizes that are not text: the hold ring's block cells (a drawing) and a
 * handle whose ──── is swapped for a rule. Each needs a reason to be here.
 */
const NOT_TEXT = new Set(['.swarm-confirm__ring', ':root[data-grid="narrow"] .sheet__handle']);

interface Rule {
  file: string;
  selector: string;
  body: string;
}

function rules(): Rule[] {
  const out: Rule[] = [];
  for (const file of STYLESHEETS) {
    const css = strip(readFileSync(file, 'utf8'));
    // Innermost blocks only: `selector { declarations }` with no nested braces.
    for (const m of css.matchAll(/([^{}]+){([^{}]*)}/g)) {
      out.push({ file: relative(ROOT, file), selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
    }
  }
  return out;
}

const ROLE_VALUE = new RegExp(`^(?:var\\(--type-(${ROLES.join('|')})\\)|min\\(var\\(--type-(${ROLES.join('|')})\\),\\s*[\\d.]+vw\\))$`);

describe('type roles', () => {
  it('defines all six roles in rem, none below 12 px', () => {
    for (const role of ROLES) {
      const rem = roleRem(role);
      expect(rem, role).toBeDefined();
      expect(rem! * DEFAULT_PX, role).toBeGreaterThanOrEqual(MIN_TEXT_PX);
    }
  });

  it('orders the roles from display down to meta', () => {
    const sizes = ROLES.map((r) => roleRem(r)!);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it('sets every font size through a role', () => {
    const offenders: string[] = [];
    for (const r of rules()) {
      for (const m of r.body.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;]+)/g)) {
        const value = m[1].trim();
        if (ROLE_VALUE.test(value) || value === 'inherit') continue;
        // The root follows the browser's text size (Story 1.31).
        if (value === '100%' && /(^|,)\s*html\b/.test(r.selector)) continue;
        if (NOT_TEXT.has(r.selector)) continue;
        offenders.push(`${r.file}: ${r.selector} { font-size: ${value} }`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('glows text only at 15 px and above', () => {
    const offenders: string[] = [];
    for (const r of rules()) {
      const shadow = r.body.match(/(?:^|;)\s*text-shadow\s*:\s*([^;]+)/)?.[1].trim();
      if (!shadow || shadow === 'none') continue;
      const size = r.body.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/)?.[1].trim() ?? '';
      const role = size.match(ROLE_VALUE);
      const rem = role ? roleRem((role[1] ?? role[2]) as Role) : undefined;
      if (rem !== undefined && rem * DEFAULT_PX >= MIN_GLOW_PX) continue;
      offenders.push(`${r.file}: ${r.selector} { text-shadow: ${shadow}; font-size: ${size || '(inherited)'} }`);
    }
    expect(offenders).toEqual([]);
  });
});
