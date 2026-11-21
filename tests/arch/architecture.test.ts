// @vitest-environment node
/**
 * Architecture boundary test (AR21, Story 1.4).
 *
 * Scans the import statements and a few identifiers of every file under
 * `src/` and fails when a layer reaches where it must not. See
 * "Architectural Boundaries" in the game architecture document.
 *
 * The two allowlists below are ratchets: they may only shrink. An entry for a
 * file that no longer exists, or that no longer needs the exception, fails
 * the test so it gets removed.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DOM_PATTERN,
  GAME_STATE_READ_PATTERN,
  GAME_STATE_WRITE_PATTERN,
  MATH_RANDOM_PATTERN,
  findCallArguments,
  findImports,
  findInCode,
  findPhaseWrites,
  layerOf,
  listSources,
  resolveInSrc,
  type SourceFile,
} from './scan';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

/** Layers that must run in Node: no DOM, no ui/, platform/ or debug/. */
const GAME_LAYERS = ['systems', 'phases', 'state', 'data', 'sim', 'utils'];
const FORBIDDEN_FOR_GAME_LAYERS = ['ui', 'platform', 'debug'];
/** Layers where randomness must come from the seeded generator (Story 3.1). */
const SEEDED_LAYERS = ['systems', 'sim'];
/** The only importer of `debug/` (behind `import.meta.env.DEV` or `?debug=1`). */
const DEBUG_IMPORTERS = ['main'];
/**
 * The only layer that may import values from `platform/` (Story 1.10): main
 * builds the platform services once at boot and passes them in. Everyone else
 * may import platform types, to declare what they receive.
 */
const PLATFORM_VALUE_IMPORTERS = ['main', 'platform'];

/**
 * Legacy UI files that still read `gameState.value` directly. UI reads state
 * through `state/selectors.ts` (Story 1.5 migrated every file and emptied this
 * list). Keep it empty: migrate a file instead of listing it. Only files under
 * `ui/panels/` may be listed.
 */
const LEGACY_GAME_STATE_READERS: readonly string[] = [];
const LEGACY_READER_SCOPE = /^ui\/panels\//;

/**
 * The legacy vanilla-DOM panels still in the game (Story 1.36). `UIRoot` and
 * `ui/components/` are gone; every other panel is a Preact component mounted
 * by its tab. What is left are the Phase 4–5 panels that FRONT → MAP and
 * STARS mount directly, until Epic 6 rebuilds them, and the refusal helper
 * only they use. The list may only shrink: migrate a panel, then remove it.
 */
const LEGACY_PANELS: readonly string[] = [
  'ui/panels/MapPanel.ts', // FRONT → MAP, Epic 6
  'ui/panels/ExpeditionPanel.ts', // FRONT → MAP, Epic 6
  'ui/panels/SpaceshipPanel.ts', // FRONT → STARS, Epic 6
  'ui/panels/ExplorationPanel.ts', // FRONT → STARS, Epic 6
  'ui/panels/CosmicPanel.ts', // FRONT → STARS, Epic 6
  'ui/panels/StarmapPanel.ts', // FRONT → STARS, Epic 6
  'ui/panels/refusal.ts', // `explain()`, used only by the panels above
];
/** Files and folders of the old panel system that must not come back (Story 1.36). */
const REMOVED_LEGACY_UI = ['ui/UIRoot.ts', 'ui/components', 'ui/shell/hosts.ts'];

/**
 * Known `Math.random` uses in `systems/`, with how many each file has.
 * Story 3.1 (#281) replaces them with the seeded generator and empties this
 * list. Counts may only go down: lower one when you remove a use.
 */
const KNOWN_MATH_RANDOM: Readonly<Record<string, number>> = {
  'systems/BattleSystem.ts': 1, // Story 3.1 (#281)
  'systems/EnemySystem.ts': 1, // Story 3.1 (#281)
  'systems/ExpeditionSystem.ts': 4, // Story 3.1 (#281)
  'systems/ExplorationSystem.ts': 5, // Story 3.1 (#281)
  'systems/MapSystem.ts': 1, // Story 3.1 (#281)
};

type Violation = string;

const inLayer = (f: SourceFile, layers: readonly string[]): boolean => layers.includes(layerOf(f.rel));

function importTargets(f: SourceFile): { layer: string; typeOnly: boolean; line: number; specifier: string }[] {
  return findImports(f.text).flatMap((ref) => {
    const target = resolveInSrc(f.rel, ref.specifier);
    return target === null ? [] : [{ layer: layerOf(target), typeOnly: ref.typeOnly, line: ref.line, specifier: ref.specifier }];
  });
}

function gameLayerViolations(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files.filter((x) => inLayer(x, GAME_LAYERS))) {
    for (const t of importTargets(f)) {
      if (FORBIDDEN_FOR_GAME_LAYERS.includes(t.layer)) {
        out.push(`${f.rel}:${t.line} imports ${t.layer}/ ('${t.specifier}')`);
      }
    }
    for (const hit of findInCode(f.text, DOM_PATTERN)) {
      out.push(`${f.rel}:${hit.line} uses the DOM API '${hit.text}'`);
    }
  }
  return out;
}

function debugImportViolations(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files) {
    const own = layerOf(f.rel);
    if (own === 'debug' || DEBUG_IMPORTERS.includes(own)) continue;
    for (const t of importTargets(f)) {
      if (t.layer === 'debug') out.push(`${f.rel}:${t.line} imports debug/ ('${t.specifier}'); only main may`);
    }
  }
  return out;
}

function platformViolations(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files.filter((x) => layerOf(x.rel) === 'platform')) {
    for (const t of importTargets(f)) {
      if (GAME_LAYERS.includes(t.layer) && !t.typeOnly) {
        out.push(`${f.rel}:${t.line} imports values from ${t.layer}/ ('${t.specifier}'); platform/ may import only types`);
      }
    }
  }
  return out;
}

/**
 * Rule 4, second half (Story 1.10): game layers reach platform services only
 * through what main passes in, so nothing but main (and platform/ itself)
 * imports a value from platform/. Game layers may not even import its types
 * (rule 1).
 */
function platformValueImports(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files.filter((x) => !PLATFORM_VALUE_IMPORTERS.includes(layerOf(x.rel)))) {
    for (const t of importTargets(f)) {
      if (t.layer === 'platform' && !t.typeOnly) {
        out.push(`${f.rel}:${t.line} imports values from platform/ ('${t.specifier}'); receive the service from main instead`);
      }
    }
  }
  return out;
}

/**
 * Rule 2 (Story 1.6): ui/ changes state only through actions/ and reads it
 * through state/. It never imports systems/, not even a type.
 */
function uiSystemsImports(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files.filter((x) => layerOf(x.rel) === 'ui')) {
    for (const t of importTargets(f)) {
      if (t.layer === 'systems') out.push(`${f.rel}:${t.line} imports systems/ ('${t.specifier}'); call an action or read state/ instead`);
    }
  }
  return out;
}

function mathRandomCounts(files: SourceFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files.filter((x) => inLayer(x, SEEDED_LAYERS))) {
    const n = findInCode(f.text, MATH_RANDOM_PATTERN).length;
    if (n > 0) counts[f.rel] = n;
  }
  return counts;
}

function uiGameStateWrites(files: SourceFile[]): Violation[] {
  return files
    .filter((f) => layerOf(f.rel) === 'ui')
    .flatMap((f) => findInCode(f.text, GAME_STATE_WRITE_PATTERN).map((h) => `${f.rel}:${h.line} writes gameState.value`));
}

function uiGameStateReaders(files: SourceFile[]): string[] {
  return files
    .filter((f) => layerOf(f.rel) === 'ui' && findInCode(f.text, GAME_STATE_READ_PATTERN).length > 0)
    .map((f) => f.rel);
}

/**
 * AR18: no event listener writes game state; a listener that needs a change
 * calls an action. Checks every inline listener passed to `subscribe(`. Named
 * listeners can't be followed statically; tests/unit/listenerStateWrites.test.ts
 * covers those at runtime.
 */
function listenerGameStateWrites(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files) {
    for (const call of findCallArguments(f.text, /(?<![\w$])subscribe\s*(?:<[^>()]*>\s*)?\(/g)) {
      if (findInCode(call.args, GAME_STATE_WRITE_PATTERN).length > 0) {
        out.push(`${f.rel}:${call.line} has an event listener that writes gameState.value; call an action instead`);
      }
    }
  }
  return out;
}

/**
 * AR23 (Story 1.19): the phase changes only through `PhaseStateMachine.commit`
 * (CONTINUE), or prestige. Nothing else writes `state.phase`.
 */
const PHASE_WRITERS = ['phases/PhaseStateMachine.ts', 'systems/PrestigeSystem.ts'];

function phaseWriteViolations(files: SourceFile[]): Violation[] {
  return files
    .filter((f) => !PHASE_WRITERS.includes(f.rel))
    .flatMap((f) => findPhaseWrites(f.text).map((h) => `${f.rel}:${h.line} writes phase; only PhaseStateMachine.commit or prestige may`));
}

const fake = (rel: string, text: string): SourceFile => ({ rel, text });

describe('architecture boundaries (AR21)', () => {
  const files = listSources(SRC);

  it('scans the real source tree', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => layerOf(f.rel) === 'systems')).toBe(true);
  });

  it('game layers import no DOM API, ui/, platform/ or debug/', () => {
    expect(gameLayerViolations(files)).toEqual([]);
  });

  it('nothing but main imports debug/', () => {
    expect(debugImportViolations(files)).toEqual([]);
  });

  it('platform/ imports only types from the game layers', () => {
    expect(platformViolations(files)).toEqual([]);
  });

  it('only main imports values from platform/', () => {
    expect(platformValueImports(files)).toEqual([]);
  });

  it('no Math.random in systems/ or sim/ beyond the known exceptions', () => {
    const counts = mathRandomCounts(files);
    const grown = Object.entries(counts)
      .filter(([rel, n]) => n > (KNOWN_MATH_RANDOM[rel] ?? 0))
      .map(([rel, n]) => `${rel}: ${n} Math.random use(s), ${KNOWN_MATH_RANDOM[rel] ?? 0} allowed; use the seeded rng`);
    expect(grown).toEqual([]);
  });

  it('the Math.random exception list only shrinks', () => {
    const counts = mathRandomCounts(files);
    const stale = Object.entries(KNOWN_MATH_RANDOM)
      .filter(([rel, n]) => (counts[rel] ?? 0) < n)
      .map(([rel, n]) =>
        existsSync(join(SRC, rel))
          ? `${rel}: ${counts[rel] ?? 0} use(s) left, list says ${n}; lower or remove the entry`
          : `${rel} no longer exists; remove the entry`,
      );
    expect(stale).toEqual([]);
    expect(Object.keys(KNOWN_MATH_RANDOM).every((rel) => layerOf(rel) === 'systems')).toBe(true);
  });

  it('no event listener writes gameState.value', () => {
    expect(listenerGameStateWrites(files)).toEqual([]);
  });

  it('ui/ never imports systems/', () => {
    expect(uiSystemsImports(files)).toEqual([]);
  });

  it('no file under ui/ writes gameState.value', () => {
    expect(uiGameStateWrites(files)).toEqual([]);
  });

  it('only allowlisted legacy ui/ files read gameState.value', () => {
    const readers = uiGameStateReaders(files);
    expect(readers.filter((rel) => !LEGACY_GAME_STATE_READERS.includes(rel))).toEqual([]);
  });

  it('the legacy reader allowlist only shrinks', () => {
    expect(LEGACY_GAME_STATE_READERS.filter((rel) => !LEGACY_READER_SCOPE.test(rel))).toEqual([]);
    const readers = new Set(uiGameStateReaders(files));
    const stale = LEGACY_GAME_STATE_READERS.filter((rel) => !readers.has(rel)).map((rel) =>
      existsSync(join(SRC, rel))
        ? `${rel} no longer reads gameState.value; remove the entry`
        : `${rel} no longer exists; remove the entry`,
    );
    expect(stale).toEqual([]);
  });

  it('the old panel system is gone: no UIRoot, no ui/components/ (Story 1.36)', () => {
    expect(REMOVED_LEGACY_UI.filter((rel) => existsSync(join(SRC, rel)))).toEqual([]);
  });

  it('ui/panels/ holds only the listed legacy FRONT panels, and the list only shrinks', () => {
    const panels = files.map((f) => f.rel).filter((rel) => rel.startsWith('ui/panels/'));
    expect(panels.filter((rel) => !LEGACY_PANELS.includes(rel))).toEqual([]);
    expect(LEGACY_PANELS.filter((rel) => !panels.includes(rel)).map((rel) => `${rel} no longer exists; remove the entry`)).toEqual([]);
  });

  it('only the FRONT segments (ui/front/) mount the legacy panels', () => {
    const out: Violation[] = [];
    for (const f of files) {
      if (f.rel.startsWith('ui/panels/') || f.rel.startsWith('ui/front/')) continue;
      for (const ref of findImports(f.text)) {
        const target = resolveInSrc(f.rel, ref.specifier);
        if (target?.startsWith('ui/panels/') && !ref.typeOnly) out.push(`${f.rel}:${ref.line} imports ${target}`);
      }
    }
    expect(out).toEqual([]);
  });

  it('only PhaseStateMachine.commit and prestige write state.phase', () => {
    expect(phaseWriteViolations(files)).toEqual([]);
    // Both writers really do write it, or the rule is pointing at the wrong files.
    for (const rel of PHASE_WRITERS) {
      const f = files.find((x) => x.rel === rel);
      expect(f && findPhaseWrites(f.text).length).toBeGreaterThan(0);
    }
  });

  // The rules must fire on a violation, or a green run proves nothing.
  describe('each rule catches a planted violation', () => {
    it('flags ui/, platform/ and debug/ imports from every game layer', () => {
      for (const layer of GAME_LAYERS) {
        const v = gameLayerViolations([
          fake(`${layer}/A.ts`, "import { UIRoot } from '../ui/UIRoot';"),
          fake(`${layer}/B.ts`, "import type { Haptics } from '../platform/haptics';"),
          fake(`${layer}/C.ts`, "export * from '../debug/overlay';"),
          fake(`${layer}/D.ts`, "const m = await import('../ui/panels/X');"),
          fake(`${layer}/deep/E.ts`, "import '../../ui/styles/base.css';"),
        ]);
        expect(v).toHaveLength(5);
      }
    });

    it('flags DOM globals in game layers but not look-alikes', () => {
      const v = gameLayerViolations([
        fake('systems/A.ts', 'document.body.classList.add(x);'),
        fake('state/B.ts', "const s = window.localStorage.getItem('k');"),
        fake('utils/C.ts', 'function f(el: HTMLDivElement) { requestAnimationFrame(() => el); }'),
        fake(
          'phases/D.ts',
          [
            '// document.body is mentioned in a comment',
            "const msg = 'open the window';",
            'const t = `navigator ${state.window} ${a.document}`;',
            'const re = /document/g;',
            'const x = state.documentCount;',
          ].join('\n'),
        ),
      ]);
      expect(v.map((x) => x.split(':')[0])).toEqual(['systems/A.ts', 'state/B.ts', 'utils/C.ts', 'utils/C.ts']);
    });

    it('allows game layers to import each other and packages', () => {
      expect(
        gameLayerViolations([
          fake('systems/A.ts', "import { signal } from '@preact/signals-core';\nimport { log } from '../utils/log';"),
          fake('phases/B.ts', "import type { GameState } from '../state/GameState';"),
        ]),
      ).toEqual([]);
    });

    it('flags debug/ imports outside main and debug/', () => {
      const v = debugImportViolations([
        fake('main.ts', "import { mountDebug } from './debug/overlay';"),
        fake('debug/overlay.ts', "import { inspect } from './inspector';"),
        fake('ui/App.ts', "import { inspect } from '../debug/inspector';"),
        fake('engine/GameLoop.ts', "if (dev) { await import('../debug/overlay'); }"),
      ]);
      expect(v.map((x) => x.split(':')[0])).toEqual(['ui/App.ts', 'engine/GameLoop.ts']);
    });

    it('flags value imports from game layers in platform/, allows type imports', () => {
      const v = platformViolations([
        fake('platform/a.ts', "import type { GameState } from '../state/GameState';"),
        fake('platform/b.ts', "import { type Phase, type GameState } from '../state/GameState';"),
        fake('platform/c.ts', "import { gameState } from '../state/gameSignal';"),
        fake('platform/d.ts', "import { type Phase, PHASES } from '../phases/phases';"),
        fake('platform/e.ts', "import * as rng from '../utils/rng';"),
        fake('platform/f.ts', "import { bus } from '../engine/EventBus';"),
      ]);
      expect(v.map((x) => x.split(':')[0])).toEqual(['platform/c.ts', 'platform/d.ts', 'platform/e.ts']);
    });

    it('flags platform/ value imports outside main, allows type imports', () => {
      const v = platformValueImports([
        fake('main.tsx', "import { createWebPlatform } from './platform';"),
        fake('platform/a.ts', "import { createWebHaptics } from './haptics';"),
        fake('ui/b.ts', "import type { Haptics } from '../platform/haptics';"),
        fake('actions/c.ts', "import { type Settings } from '../platform/settings';"),
        fake('ui/d.ts', "import { createWebHaptics } from '../platform/haptics';"),
        fake('engine/e.ts', "import { detectCapabilities } from '../platform/capabilities';"),
        fake('actions/f.ts', "const m = await import('../platform/settings');"),
      ]);
      expect(v.map((x) => x.split(':')[0])).toEqual(['ui/d.ts', 'engine/e.ts', 'actions/f.ts']);
    });

    it('counts Math.random in systems/ and sim/ only, ignoring comments and strings', () => {
      const counts = mathRandomCounts([
        fake('systems/A.ts', 'const a = Math.random();\nconst b = Math.random() * 2;'),
        fake('sim/B.ts', 'const r = Math.random();'),
        fake('systems/C.ts', "// Math.random()\nconst s = 'Math.random';\nconst r = rng.random();"),
        fake('ui/D.ts', 'const jitter = Math.random();'),
      ]);
      expect(counts).toEqual({ 'systems/A.ts': 2, 'sim/B.ts': 1 });
    });

    it('flags any systems/ import under ui/, type-only included', () => {
      const v = uiSystemsImports([
        fake('ui/a.ts', "import { build } from '../systems/BuildingSystem';"),
        fake('ui/panels/b.ts', "import type { BuildingType } from '../../systems/BuildingSystem';"),
        fake('ui/c.ts', "export { getEffects } from '../systems/BuildingSystem';"),
        fake('ui/d.ts', "const m = await import('../systems/BattleSystem');"),
        fake('ui/e.ts', "import { createActions } from '../actions';\nimport { getBuildCost } from '../state/queries';"),
        fake('actions/f.ts', "import { build } from '../systems/BuildingSystem';"),
        fake('state/g.ts', "export { getEffects } from '../systems/BuildingSystem';"),
      ]);
      expect(v.map((x) => x.split(':')[0])).toEqual(['ui/a.ts', 'ui/panels/b.ts', 'ui/c.ts', 'ui/d.ts']);
    });

    it('flags gameState.value writes under ui/, not reads or comparisons', () => {
      const v = uiGameStateWrites([
        fake('ui/a.ts', 'gameState.value = next;'),
        fake('ui/b.ts', 'gameState.value.resources.eggs += 1;'),
        fake('ui/c.ts', "gameState.value['paused'] = true;"),
        fake('ui/d.ts', 'gameState.value.stats.totalClicks++;'),
        fake('ui/e.ts', 'Object.assign(gameState.value, patch);'),
        fake(
          'ui/f.ts',
          [
            'const s = gameState.value;',
            'if (gameState.value.paused === true) {}',
            'const ok = gameState.value.resources.eggs >= 3;',
            '// gameState.value = x',
          ].join('\n'),
        ),
        fake('actions/g.ts', 'gameState.value = next;'),
      ]);
      expect(v.map((x) => x.split(':')[0])).toEqual(['ui/a.ts', 'ui/b.ts', 'ui/c.ts', 'ui/d.ts', 'ui/e.ts']);
    });

    it('flags inline event listeners that write gameState.value, anywhere in src/', () => {
      const v = listenerGameStateWrites([
        fake('main.ts', "bus.subscribe('decision_chosen', ({ choice }) => {\n  gameState.value = apply(gameState.value, choice);\n});"),
        fake('ui/a.ts', "this.bus.subscribe('battle_completed', function () { gameState.value.paused = true; });"),
        fake('engine/b.ts', "bus.subscribe<'x'>('x', () => Object.assign(gameState.value, { paused: true }));"),
        fake(
          'main2.ts',
          [
            "bus.subscribe('battle_completed', () => { save(gameState.value); });",
            "bus.subscribe('prestige_triggered', actionSave);",
            "bus.subscribe('egg_clicked', () => { chooseDecision(type, choice); });",
            "const s = (() => { gameState.value = next; })();",
          ].join('\n'),
        ),
      ]);
      expect(v.map((x) => x.split(' ')[0])).toEqual(['main.ts:1', 'ui/a.ts:1', 'engine/b.ts:1']);
    });

    it('flags phase writes outside the phase machine and prestige, not payloads or types', () => {
      const v = phaseWriteViolations([
        fake('main.ts', 'newState = { ...tickResult.state, phase: tickResult.phase };'),
        fake('actions/a.ts', 'const next = { ...s, resources: { ...s.resources }, phase };'),
        fake('systems/b.ts', 'state.phase = Phase.COLONY;'),
        fake('ui/c.ts', 's.phase = x;'),
        fake(
          'engine/ok.ts',
          [
            "bus.emit('phase_committed', { from: Phase.COLONY, to: Phase.COMBAT });",
            'interface X { phase: string; paused: boolean }',
            'const goal = { ...g, phaseGoal: null };',
            'if (s.phase === Phase.COLONY) {}',
            'const t = { ...a, inner: { phase: 1 } };',
            '// { ...s, phase: x }',
            "if (root.dataset.phase !== token) root.dataset.phase = token;",
          ].join('\n'),
        ),
        fake('phases/PhaseStateMachine.ts', 'return { ...entered, phase: t.to };'),
        fake('systems/PrestigeSystem.ts', 'return { ...s, phase: basePhase };'),
      ]);
      expect(v.map((x) => x.split(':')[0])).toEqual(['main.ts', 'actions/a.ts', 'systems/b.ts', 'ui/c.ts']);
    });

    it('finds gameState.value readers under ui/ only', () => {
      const readers = uiGameStateReaders([
        fake('ui/tabs/nest/Nest.ts', 'const eggs = gameState.value.resources.eggs;'),
        fake('ui/shell/Strip.ts', 'const s = gameState.peek();'),
        fake('ui/shell/Clean.ts', "import { selectFood } from '../../state/selectors';"),
        fake('actions/buy.ts', 'const s = gameState.value;'),
      ]);
      expect(readers).toEqual(['ui/tabs/nest/Nest.ts', 'ui/shell/Strip.ts']);
    });
  });
});
