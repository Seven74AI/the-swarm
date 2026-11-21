// @vitest-environment node
/**
 * Boundary test, Story 3.2 (FR40, AR19, AR20): balance lives in data files.
 *
 * 1. No balance literal in `systems/` (or the engine files that do balance
 *    math): every numeric literal there other than `0` and `1` fails. Costs,
 *    rates, timers, caps and factors come from `data/balance/<system>.ts` or
 *    `data/constants.ts`; structural numbers have names there too
 *    (`MS_PER_SEC`, `PERCENT`) or a helper (`midpoint`). Comments and strings
 *    are ignored, so a doc comment may still say "50 s".
 * 2. Units: no balance key names a tick; durations end in `Ms`, rates in
 *    `PerSec` (a key ending in time/duration/delay/interval/timer or rate fails).
 *
 * `PENDING_BALANCE_LITERALS` is a ratchet, like the Math.random list in
 * architecture.test.ts: the Phase 4–6 and Legacy systems that later epics
 * rebuild (Epic 5 expansion, Epic 6 space, Epic 7 prestige) keep their
 * literals until then. Counts may only go down; a stale entry fails.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listSources, strip } from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const sources = listSources(SRC);

/** Engine files that do balance math (the rest of engine/ is plumbing). */
const BALANCE_ENGINE_FILES = ['engine/ProgressionCurve.ts', 'engine/AutoProductionLoop.ts', 'engine/processTick.ts'];
const inScope = (rel: string): boolean => rel.startsWith('systems/') || BALANCE_ENGINE_FILES.includes(rel);

/** The only numeric literals a scanned file may spell: identity values. */
const STRUCTURAL = new Set([0, 1]);

/**
 * Files that still spell balance literals, with how many. Only files outside
 * Story 3.2's scope (Phases 1–3) may be listed, each with the epic that moves
 * its numbers. Counts may only go down.
 */
const PENDING_BALANCE_LITERALS: Readonly<Record<string, number>> = {
  'systems/ExpeditionSystem.ts': 24, // Epic 5 (expansion)
  'systems/MapSystem.ts': 6, // Epic 5 (expansion)
  'systems/TerritorySystem.ts': 4, // Epic 5 (expansion)
  'systems/ExplorationSystem.ts': 28, // Epic 6 (space)
  'systems/SpaceshipSystem.ts': 75, // Epic 6 (space)
  'systems/ResourceConversionSystem.ts': 6, // Epic 6 (space)
  'systems/EntropySystem.ts': 24, // Epic 6 (transcendence)
  'systems/PrestigeSystem.ts': 26, // Epic 7 (Legacy)
};

const NUMBER = /(?<![\w$.])(?:\d[\d_]*(?:\.\d[\d_]*)?(?:e[+-]?\d+)?|\.\d[\d_]*(?:e[+-]?\d+)?)(?![\w.])/gi;

interface LiteralHit {
  line: number;
  text: string;
}

/** Numeric literals in code (comments and strings blanked) other than 0 and 1. */
export function balanceLiterals(src: string): LiteralHit[] {
  const lines = strip(src).code.split('\n');
  const out: LiteralHit[] = [];
  lines.forEach((l, i) => {
    for (const m of l.matchAll(NUMBER)) {
      if (!STRUCTURAL.has(Number(m[0].replace(/_/g, '')))) out.push({ line: i + 1, text: m[0] });
    }
  });
  return out;
}

function counts(): Record<string, LiteralHit[]> {
  const out: Record<string, LiteralHit[]> = {};
  for (const f of sources.filter((x) => inScope(x.rel))) {
    const hits = balanceLiterals(f.text);
    if (hits.length > 0) out[f.rel] = hits;
  }
  return out;
}

describe('balance lives in data files (Story 3.2)', () => {
  it('systems/ spells no balance literal beyond the pending list', () => {
    const grown = Object.entries(counts())
      .filter(([rel, hits]) => hits.length > (PENDING_BALANCE_LITERALS[rel] ?? 0))
      .map(([rel, hits]) =>
        `${rel}: ${hits.length} literal(s), ${PENDING_BALANCE_LITERALS[rel] ?? 0} allowed; move them to data/balance/ (${hits
          .map((h) => `${h.line}:${h.text}`)
          .join(', ')})`,
      );
    expect(grown).toEqual([]);
  });

  it('the pending list only shrinks', () => {
    const now = counts();
    const stale = Object.entries(PENDING_BALANCE_LITERALS)
      .filter(([rel, n]) => (now[rel]?.length ?? 0) < n)
      .map(([rel, n]) =>
        existsSync(join(SRC, rel))
          ? `${rel}: ${now[rel]?.length ?? 0} literal(s) left, list says ${n}; lower or remove the entry`
          : `${rel} no longer exists; remove the entry`,
      );
    expect(stale).toEqual([]);
    expect(Object.keys(PENDING_BALANCE_LITERALS).every(inScope)).toBe(true);
  });

  it('the scan catches balance literals and ignores identity values, comments and strings', () => {
    const sample = [
      'export const EGG_HATCH_TIME = 50; // ticks',
      'const k = 1 / 0.25 + 1_000 + .5 + 2e3;',
      "const label = 'needs 40 wood'; /* 99 */",
      'const x2 = a[0] + 1.0 - b.c1;',
    ].join('\n');
    expect(balanceLiterals(sample).map((h) => h.text)).toEqual(['50', '0.25', '1_000', '.5', '2e3']);
  });
});

/** Every key of a balance object, with its dotted path. */
function keysOf(value: unknown, path: string): string[] {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keysOf(v, `${path}.${k}`)]);
}

const balanceModules = import.meta.glob<Record<string, unknown>>('../../src/data/balance/*.ts', { eager: true });

describe('balance data has explicit units (Story 3.2)', () => {
  const keys = Object.entries(balanceModules).flatMap(([file, mod]) =>
    Object.entries(mod).flatMap(([name, value]) => [name, ...keysOf(value, `${file.replace(/^.*\//, '')}:${name}`)]),
  );
  const last = (k: string): string => k.split(/[.:]/).pop()!;

  it('there are balance files to check', () => {
    expect(Object.keys(balanceModules).length).toBeGreaterThan(1);
  });

  it('no balance value is expressed in ticks', () => {
    expect(keys.filter((k) => /tick/i.test(last(k)))).toEqual([]);
    const constants = sources.find((f) => f.rel === 'data/constants.ts')!;
    const declared = [...strip(constants.text).code.matchAll(/export const (\w+)/g)].map((m) => m[1]);
    expect(declared.filter((n) => /tick/i.test(n) && n !== 'TICK_MS')).toEqual([]);
  });

  it('durations are named …Ms and rates …PerSec', () => {
    expect(keys.filter((k) => /(?:time|duration|delay|interval|timer|seconds)$|(?<!per)secs?$/i.test(last(k)))).toEqual([]);
    expect(keys.filter((k) => /rate$/i.test(last(k)))).toEqual([]);
  });
});
