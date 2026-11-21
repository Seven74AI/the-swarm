// @vitest-environment node
/**
 * Boundary test, Story 5.5 (FR31): the victory record is a record, not a
 * reward. `victoryAchieved` is written once (the Transcendence transition),
 * kept by prestige and saved, and read only by the UI through its selectors:
 * no system, guard, cost or unlock reads it.
 *
 * Allowed references, in code (comments and string text don't count):
 * - `state/GameState.ts`: the field and its initial value;
 * - `state/selectors.ts`: the selectors the UI reads;
 * - `ui/`: the screens;
 * - `persistence/`: the save and its migrations;
 * - `phases/transitions.ts`: the one write, `victoryAchieved: true`, and nothing else.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findInCode, layerOf, listSources } from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const FIELD = /(?<![\w$])victoryAchieved\b/g;
const WRITE = /(?<![\w$])victoryAchieved\s*:\s*true\b/g;

const ALLOWED_FILES = new Set(['state/GameState.ts', 'state/selectors.ts']);
const ALLOWED_LAYERS = new Set(['ui', 'persistence']);
const WRITER = 'phases/transitions.ts';

const sources = listSources(SRC);

describe('the victory record is read only by the UI (Story 5.5)', () => {
  it('the field exists and is written by the Transcendence transition (so the rule is not vacuous)', () => {
    const writer = sources.find((f) => f.rel === WRITER)!;
    expect(findInCode(writer.text, WRITE).length).toBeGreaterThan(0);
    expect(sources.filter((f) => ALLOWED_LAYERS.has(layerOf(f.rel))).some((f) => findInCode(f.text, FIELD).length > 0)).toBe(true);
  });

  it('no system, guard, cost or unlock reads it', () => {
    const offenders = sources.flatMap((f) => {
      if (ALLOWED_FILES.has(f.rel) || ALLOWED_LAYERS.has(layerOf(f.rel))) return [];
      const refs = findInCode(f.text, FIELD);
      const writes = f.rel === WRITER ? findInCode(f.text, WRITE).length : 0;
      return refs.length > writes ? [`${f.rel}: ${refs.map((h) => `line ${h.line}`).join(', ')}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
