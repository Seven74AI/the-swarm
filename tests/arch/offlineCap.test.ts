// @vitest-environment node
/**
 * Boundary test, Story 2.4 (FR20, AR3): one offline cap.
 *
 * Resumed time is limited only by `getOfflineCapMs(state)` in
 * `systems/OfflineProgression.ts`, whose values live in `data/constants.ts`.
 * The old 4 h cap (OfflineProgression), 8 h accumulator cap (GameLoop) and
 * 1 s frame cap (Ticker) are gone, and no file brings back a cap of its own:
 * 1. Hour-sized millisecond values are spelled only in `data/constants.ts`.
 * 2. Only `systems/OfflineProgression.ts` clamps elapsed, offline,
 *    accumulated or frame time (`Math.min(...)` over such a value).
 * 3. Offline-cap constants are declared only in `data/constants.ts`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findInCode, listSources } from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const CONSTANTS = 'data/constants.ts';
const CAP_FILE = 'systems/OfflineProgression.ts';
const sources = listSources(SRC);

const HOUR_MS = [
  /\b\d+(?:\.\d+)?\s*\*\s*60\s*\*\s*60\s*\*\s*1_?000\b/g, // N * 60 * 60 * 1000
  /\b60\s*\*\s*60\s*\*\s*1_?000\b/g, // 60 * 60 * 1000
  /\b\d+(?:\.\d+)?\s*\*\s*3_?600_?000\b/g, // N * 3_600_000
  /\b\d+(?:\.\d+)?\s*\*\s*3_?600\s*\*\s*1_?000\b/g, // N * 3600 * 1000
  /(?<![\w.])(?:3_?600_?000|14_?400_?000|28_?800_?000|43_?200_?000|86_?400_?000)(?![\w.])/g,
];
const TIME_CLAMP = /Math\s*\.\s*min\s*\([^;{}]*?(?:\belapsed\w*|\boffline\w*|\baccumulat\w*|\blastTime\b|\bnow\s*-|\bgap\w*)/gi;
const CAP_DECL = /\b(?:const|let|var)\s+(\w*(?:OFFLINE_?CAP|MAX_?OFFLINE|offlineCap|maxOffline|ACCUMULATOR_?CAP|MAX_?FRAME|maxFrame)\w*)\s*=/gi;

function hits(pattern: RegExp, allowed: string[]): string[] {
  return sources
    .filter((f) => !allowed.includes(f.rel))
    .flatMap((f) => findInCode(f.text, new RegExp(pattern.source, pattern.flags)).map((h) => `${f.rel}:${h.line} ${h.text}`));
}

describe('one offline cap (Story 2.4)', () => {
  it('hour-sized millisecond values live only in data/constants.ts', () => {
    expect(HOUR_MS.flatMap((p) => hits(p, [CONSTANTS]))).toEqual([]);
  });

  it('only OfflineProgression clamps elapsed, offline, accumulated or frame time', () => {
    expect(hits(TIME_CLAMP, [CAP_FILE])).toEqual([]);
  });

  it('offline-cap constants are declared only in data/constants.ts', () => {
    expect(hits(CAP_DECL, [CONSTANTS])).toEqual([]);
  });

  it('the cap file reads its values from data/constants.ts through getOfflineCapMs', () => {
    const cap = sources.find((f) => f.rel === CAP_FILE)!;
    expect(cap.text).toMatch(/export function getOfflineCapMs\(/);
    expect(cap.text).toMatch(/from '\.\.\/data\/constants'/);
  });

  it('the scan catches the old caps', () => {
    const old = [
      'const OFFLINE_CAP_MS = 4 * 60 * 60 * 1000;',
      'this.ticker.setAccumulator(Math.min(ms, 8 * 60 * 60 * 1000));',
      'const dt = Math.min(now - this.lastTime, 1000);',
    ].join('\n');
    expect(HOUR_MS.flatMap((p) => findInCode(old, new RegExp(p.source, p.flags)))).not.toEqual([]);
    expect(findInCode(old, new RegExp(TIME_CLAMP.source, TIME_CLAMP.flags))).toHaveLength(1);
    expect(findInCode(old, new RegExp(CAP_DECL.source, CAP_DECL.flags))).toHaveLength(1);
  });
});
