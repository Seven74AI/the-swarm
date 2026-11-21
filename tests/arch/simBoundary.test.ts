// @vitest-environment node
/**
 * Boundary test, Story 3.7 (AR15, D12): the headless simulated player plays
 * the real game and nothing else.
 *
 * 1. `src/sim/` exists (so the rules below are not vacuous).
 * 2. It imports no `ui/`, `platform/` or `debug/` and uses no DOM API.
 * 3. Time moves only through `engine/resume`: sim/ never imports a value from
 *    the catch-up, the tick, the game loop or the ticker (a type is fine).
 * 4. Moves go only through `actions/`: sim/ calls no method of a system
 *    instance, and never touches the live `gameState` signal (it owns its state).
 * 5. No `Math.random`: runs follow the state's seeded generator.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOM_PATTERN, MATH_RANDOM_PATTERN, findImports, findInCode, layerOf, listSources, resolveInSrc } from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const sim = listSources(SRC).filter((f) => layerOf(f.rel) === 'sim');

const FORBIDDEN_LAYERS = ['ui', 'platform', 'debug'];
/** Modules that advance time or write the live state; sim/ reaches them only through resume and actions. */
const FORBIDDEN_MODULES = ['engine/catchUp', 'engine/processTick', 'engine/GameLoop', 'engine/Ticker', 'engine/AutoProductionLoop', 'state/gameSignal'];
const SYSTEM_CALL = /\b(?:resourceSystem|soldierSystem|battleSystem|territorySystem|mapSystem)\s*\.\s*\w+\s*\(/g;
const LIVE_STATE = /(?<![\w$.])gameState\b/g;

function imports(): { rel: string; line: number; target: string; typeOnly: boolean }[] {
  return sim.flatMap((f) =>
    findImports(f.text).flatMap((ref) => {
      const target = resolveInSrc(f.rel, ref.specifier);
      if (target === null) return [];
      return [{ rel: f.rel, line: ref.line, target: target.replace(/\.tsx?$/, '').replace(/\/index$/, ''), typeOnly: ref.typeOnly }];
    }),
  );
}

describe('sim/ boundary (Story 3.7)', () => {
  it('exists', () => {
    expect(sim.map((f) => f.rel)).toEqual(expect.arrayContaining(['sim/runner.ts', 'sim/policy.ts', 'sim/probes.ts', 'sim/schedule.ts']));
  });

  it('imports no ui/, platform/ or debug/ and uses no DOM API', () => {
    const bad = [
      ...imports()
        .filter((i) => FORBIDDEN_LAYERS.includes(layerOf(i.target)))
        .map((i) => `${i.rel}:${i.line} imports ${i.target}`),
      ...sim.flatMap((f) => findInCode(f.text, DOM_PATTERN).map((h) => `${f.rel}:${h.line} uses ${h.text}`)),
    ];
    expect(bad).toEqual([]);
  });

  it('advances time only through engine/resume', () => {
    const bad = imports()
      .filter((i) => !i.typeOnly && FORBIDDEN_MODULES.includes(i.target))
      .map((i) => `${i.rel}:${i.line} imports ${i.target}`);
    expect(bad).toEqual([]);
    expect(imports().some((i) => i.target === 'engine/resume')).toBe(true);
  });

  it('moves only through actions/: no system method calls, no live state', () => {
    const bad = sim.flatMap((f) => [
      ...findInCode(f.text, SYSTEM_CALL).map((h) => `${f.rel}:${h.line} calls ${h.text}`),
      ...findInCode(f.text, LIVE_STATE).map((h) => `${f.rel}:${h.line} touches ${h.text}`),
    ]);
    expect(bad).toEqual([]);
    expect(imports().some((i) => i.target === 'actions' && !i.typeOnly)).toBe(true);
  });

  it('draws no Math.random', () => {
    expect(sim.flatMap((f) => findInCode(f.text, MATH_RANDOM_PATTERN).map((h) => `${f.rel}:${h.line}`))).toEqual([]);
  });

  it('flags a forbidden reach (self-check)', () => {
    expect(findInCode('x = resourceSystem.clickEgg(s);', SYSTEM_CALL)).toHaveLength(1);
    expect(findInCode('gameState.value = s;', LIVE_STATE)).toHaveLength(1);
  });
});
