// @vitest-environment node
/**
 * Boundary test, Story 8.5 (AR14, D11, N1): the scenes are views.
 *
 * `selectNestView` (≤ 4 Hz) → pure `nestLayout(view)` → dumb SVG. The scene
 * code in `ui/scenes/` gets its view as a prop:
 *
 * 1. `ui/scenes/` exists and holds the nest scene and its layout (so the rules
 *    below are not vacuous).
 * 2. It never reads the game state: no `gameState`, and no value import from
 *    `state/` (a type is fine), `actions/`, `systems/`, `engine/`,
 *    `persistence/` or `platform/`.
 * 3. It never writes anything: no signal write (`x.value =`), no storage.
 * 4. No `Math.random`: a layout is the same for the same view.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MATH_RANDOM_PATTERN, findImports, findInCode, layerOf, listSources, resolveInSrc } from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const scenes = listSources(SRC).filter((f) => f.rel.startsWith('ui/scenes/'));

/** Layers a scene never takes a value from: the state and everything that changes it. */
const FORBIDDEN_LAYERS = ['state', 'actions', 'systems', 'engine', 'persistence', 'platform', 'phases'];
const LIVE_STATE = /(?<![\w$.])gameState\b/g;
/** A signal write (`x.value = …`, `x.value += …`), not a comparison. */
const SIGNAL_WRITE = /\.\s*value\s*(?:[-+*/%]?=)(?!=)/g;
const STORAGE = /(?<![\w$.])(?:localStorage|sessionStorage|indexedDB)\b/g;

describe('ui/scenes boundary (Story 8.5)', () => {
  it('exists', () => {
    expect(scenes.map((f) => f.rel)).toEqual(expect.arrayContaining(['ui/scenes/NestScene.tsx', 'ui/scenes/nestLayout.ts']));
  });

  it('never reads the game state: no gameState, no value from state/, actions/, systems/ …', () => {
    const bad = scenes.flatMap((f) => [
      ...findInCode(f.text, LIVE_STATE).map((h) => `${f.rel}:${h.line} touches ${h.text}`),
      ...findImports(f.text)
        .filter((ref) => !ref.typeOnly)
        .map((ref) => ({ ref, target: resolveInSrc(f.rel, ref.specifier) }))
        .filter(({ target }) => target !== null && FORBIDDEN_LAYERS.includes(layerOf(target)))
        .map(({ ref, target }) => `${f.rel}:${ref.line} imports ${target}`),
    ]);
    expect(bad).toEqual([]);
  });

  it('never writes anything: no signal write, no storage', () => {
    const bad = scenes.flatMap((f) => [
      ...findInCode(f.text, SIGNAL_WRITE).map((h) => `${f.rel}:${h.line} writes ${h.text}`),
      ...findInCode(f.text, STORAGE).map((h) => `${f.rel}:${h.line} uses ${h.text}`),
    ]);
    expect(bad).toEqual([]);
  });

  it('draws no Math.random', () => {
    expect(scenes.flatMap((f) => findInCode(f.text, MATH_RANDOM_PATTERN).map((h) => `${f.rel}:${h.line}`))).toEqual([]);
  });

  it('flags a forbidden reach (self-check)', () => {
    expect(findInCode('gameState.value.resources', LIVE_STATE)).toHaveLength(1);
    expect(findInCode('view.value = next;', SIGNAL_WRITE)).toHaveLength(1);
    expect(findInCode('if (view.value === next) {}', SIGNAL_WRITE)).toHaveLength(0);
    expect(findInCode('localStorage.setItem(k, v)', STORAGE)).toHaveLength(1);
  });
});
