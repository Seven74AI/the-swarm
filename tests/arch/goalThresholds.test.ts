// @vitest-environment node
/**
 * Boundary test, Story 1.18 (AR5, ADR 0003): goal thresholds live only in
 * `src/phases/transitions.ts`. The UI reads conditions through
 * `state/selectors.ts` and never restates a number.
 *
 * Rules:
 * 1. Outside `phases/`, only `main` (FSM wiring) and `state/` (the selectors)
 *    import `phases/transitions`; `ui/` never does, not even for a type.
 * 2. In the presenting layers (ui/, state/, data/, actions/), no code compares
 *    a condition's field with its threshold (`workers >= <target>`), and no
 *    text or code spells a goal as `<target> <label>` ("50 workers").
 *    `systems/` keeps its own game rules, so it is not scanned here.
 *
 * Thresholds are read from the conditions themselves, never copied here.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TRANSITIONS } from '../../src/phases/transitions';
import { createInitialState } from '../../src/state/GameState';
import { findImports, layerOf, listSources, resolveInSrc, strip, type SourceFile } from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const TRANSITIONS_FILE = 'phases/transitions.ts';
const TRANSITIONS_IMPORTERS = ['main', 'state', 'phases'];
const SCANNED_LAYERS = ['ui', 'state', 'data', 'actions'];

interface Threshold {
  readonly field: string;
  readonly words: readonly string[];
  readonly target: number;
}

function thresholds(): Threshold[] {
  const s = createInitialState();
  return TRANSITIONS.flatMap((t) =>
    t.conditions.map((c) => ({
      field: c.id,
      words: [c.label, ...(c.one ? [c.one] : [])],
      target: c.target(s),
    })),
  );
}

const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function importViolations(files: SourceFile[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (TRANSITIONS_IMPORTERS.includes(layerOf(f.rel))) continue;
    for (const ref of findImports(f.text)) {
      const target = resolveInSrc(f.rel, ref.specifier);
      if (target !== null && target.replace(/\.tsx?$/, '') === TRANSITIONS_FILE.replace(/\.ts$/, '')) {
        out.push(`${f.rel}:${ref.line} imports ${TRANSITIONS_FILE}; read goals through state/selectors`);
      }
    }
  }
  return out;
}

function thresholdViolations(files: SourceFile[], list: readonly Threshold[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.rel === TRANSITIONS_FILE || !SCANNED_LAYERS.includes(layerOf(f.rel))) continue;
    const { noComments } = strip(f.text);
    const lines = noComments.split('\n');
    lines.forEach((line, i) => {
      for (const t of list) {
        const n = esc(String(t.target));
        const compare = new RegExp(
          `\\b${esc(t.field)}\\b[\\w.?\\s]*(?:>=|<=|>|<|===|==)\\s*${n}(?![\\w.])|(?<![\\w.])${n}\\s*(?:>=|<=|>|<|===|==)\\s*[\\w.?]*\\b${esc(t.field)}\\b`,
        );
        const spelled = new RegExp(`(?<![\\w.])${n}\\s+(?:${t.words.map(esc).join('|')})\\b`, 'i');
        if (compare.test(line) || spelled.test(line)) {
          out.push(`${f.rel}:${i + 1} restates the goal threshold ${t.target} for '${t.field}'`);
        }
      }
    });
  }
  return out;
}

describe('goal thresholds live only in transitions.ts (Story 1.18)', () => {
  const files = listSources(SRC);
  const list = thresholds();

  it('reads real conditions', () => {
    expect(list.length).toBeGreaterThan(0);
  });

  it('only main and state/ import transitions.ts outside phases/', () => {
    expect(importViolations(files)).toEqual([]);
  });

  it('no presenting layer restates a goal threshold', () => {
    expect(thresholdViolations(files, list)).toEqual([]);
  });

  describe('each rule catches a planted violation', () => {
    const t: Threshold = { field: 'workers', words: ['workers', 'worker'], target: 37 };

    it('flags ui/ importing transitions.ts, type-only included', () => {
      const planted: SourceFile[] = [
        { rel: 'ui/a.tsx', text: "import { TRANSITIONS } from '../phases/transitions';" },
        { rel: 'ui/shell/b.tsx', text: "import type { GoalCondition } from '../../phases/transitions';" },
        { rel: 'state/c.ts', text: "import { goalFor } from '../phases/transitions';" },
        { rel: 'main.tsx', text: "import { TRANSITIONS } from './phases/transitions';" },
      ];
      expect(importViolations(planted).map((v) => v.split(':')[0])).toEqual(['ui/a.tsx', 'ui/shell/b.tsx']);
    });

    it('flags comparisons and spelled-out goals, not other numbers or comments', () => {
      const planted: SourceFile[] = [
        { rel: 'ui/a.ts', text: 'if (s.resources.workers >= 37) show();' },
        { rel: 'ui/b.ts', text: "const hint = 'Reach 37 Workers to grow';" },
        { rel: 'state/c.ts', text: 'const ok = 37 <= s.resources.workers;' },
        { rel: 'ui/d.ts', text: '// at 37 workers the colony grows\nconst x = workers + 37;' },
        { rel: 'ui/e.ts', text: 'if (s.resources.workers >= 370) show();' },
        { rel: 'systems/f.ts', text: 'if (s.resources.workers >= 37) fight();' },
        { rel: 'phases/transitions.ts', text: 'workers >= 37' },
      ];
      expect(thresholdViolations(planted, [t]).map((v) => v.split(':')[0])).toEqual([
        'ui/a.ts',
        'ui/b.ts',
        'state/c.ts',
      ]);
    });
  });
});
