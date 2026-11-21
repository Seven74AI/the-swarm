import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SaveManager, type SaveData } from '../../src/persistence/SaveManager';
import { migrateSave } from '../../src/persistence/migrations';
import { createLocalSaveStore } from '../../src/platform/storage/SaveStore';
import type { GameState } from '../../src/state/GameState';
import { Phase } from '../../src/phases/phases';
import { EventBus } from '../../src/engine/EventBus';
import { EventQueue } from '../../src/engine/events';
import { processTick } from '../../src/engine/processTick';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';

/**
 * Story 2.1 (AR7, NFR8): a save from every shipped version keeps loading.
 *
 * `tests/saves/` holds real save files, one or more per shipped save version
 * (v1–v11 were written by hand from each version's shape; v12 onward were
 * built from `createInitialState()` at the commit where that version shipped,
 * with mid-game values, so they hold exactly the fields that version wrote).
 * Every one migrates step by step to `SaveManager.SAVE_VERSION`, loads through
 * `SaveManager`, and passes the state invariants.
 *
 * Raising `SAVE_VERSION` without adding a fixture for the version before it
 * fails the coverage test below: save a real game at the old version into
 * `tests/saves/v<old>.json` before bumping.
 */

const SAVES_DIR = path.join(__dirname, '..', 'saves');
const CURRENT = SaveManager.SAVE_VERSION;

/**
 * Versions whose shape can't be rebuilt from git history, so a fixture would
 * be invented. Each needs the reason. None so far.
 */
const RETIRED: Readonly<Record<number, string>> = {};

interface Fixture {
  file: string;
  data: SaveData;
}

function readFixtures(): Fixture[] {
  return fs
    .readdirSync(SAVES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => ({ file, data: JSON.parse(fs.readFileSync(path.join(SAVES_DIR, file), 'utf-8')) as SaveData }));
}

const fixtures = readFixtures();
const PHASES = new Set<string>(Object.values(Phase));

/** Load a save the way the game does: from localStorage, through SaveManager. */
function loadThroughSaveManager(data: SaveData) {
  localStorage.clear();
  localStorage.setItem('the_swarm_save', JSON.stringify(data));
  return new SaveManager(createLocalSaveStore(localStorage)).load();
}

/** The state invariants every loaded save must hold. */
function expectValidState(gs: GameState, where: string, { integers = true } = {}): void {
  expect(PHASES.has(gs.phase), `${where}: phase "${gs.phase}" is a game phase`).toBe(true);
  for (const [key, value] of Object.entries(gs.resources)) {
    expect(Number.isFinite(value), `${where}: resources.${key} = ${value} is a number`).toBe(true);
    if (integers) expect(Number.isInteger(value), `${where}: resources.${key} = ${value} is an integer`).toBe(true);
    expect(value, `${where}: resources.${key} >= 0`).toBeGreaterThanOrEqual(0);
  }
  for (const key of ['eggPipeline', 'larvaPipeline', 'soldierPipeline'] as const) {
    const p = gs[key];
    expect(Number.isInteger(p.count), `${where}: ${key}.count is an integer`).toBe(true);
    expect(p.count, `${where}: ${key}.count >= 0`).toBeGreaterThanOrEqual(0);
    expect(p.progress, `${where}: ${key}.progress >= 0`).toBeGreaterThanOrEqual(0);
  }
}

function tickOnce(state: GameState): GameState {
  const bus = new EventBus();
  return processTick(
    state,
    new ResourceSystem(bus),
    new SoldierSystem(bus),
    new MapSystem(),
    new TerritorySystem(),
    new EventQueue(),
    0.05,
  );
}

describe('save fixtures (Story 2.1)', () => {
  beforeEach(() => localStorage.clear());

  it('has a fixture, or a retirement reason, for every shipped version before the current one', () => {
    const versions = new Set(fixtures.map((f) => f.data.version));
    for (let v = 1; v < CURRENT; v++) {
      const covered = versions.has(v) || RETIRED[v] !== undefined;
      expect(covered, `v${v} needs a save in tests/saves/ (or a reason in RETIRED)`).toBe(true);
    }
  });

  it('retires only versions that have no fixture, each with a reason', () => {
    const versions = new Set(fixtures.map((f) => f.data.version));
    for (const [v, reason] of Object.entries(RETIRED)) {
      expect(versions.has(Number(v)), `v${v} is retired but has a fixture`).toBe(false);
      expect(reason.trim().length, `v${v} retirement needs a reason`).toBeGreaterThan(0);
    }
  });

  it('holds only saves from shipped versions, each a full save envelope', () => {
    for (const { file, data } of fixtures) {
      expect(Number.isInteger(data.version), `${file}: version`).toBe(true);
      expect(data.version, `${file}: version`).toBeGreaterThanOrEqual(1);
      expect(data.version, `${file}: version`).toBeLessThanOrEqual(CURRENT);
      expect(typeof data.timestamp, `${file}: timestamp`).toBe('number');
      expect(typeof data.gameState, `${file}: gameState`).toBe('object');
    }
  });

  for (const { file, data } of fixtures) {
    describe(`${file} (v${data.version})`, () => {
      it('migrates one version at a time up to the current version', () => {
        let current: SaveData = structuredClone(data);
        for (let v = data.version; v < CURRENT; v++) {
          current = migrateSave(current, v, v + 1);
          expect(current.version, `${file}: step v${v} → v${v + 1}`).toBe(v + 1);
        }
        expect(current.version).toBe(CURRENT);
        expect(migrateSave(structuredClone(data), data.version, CURRENT).version).toBe(CURRENT);
      });

      it('loads through SaveManager and passes the state invariants', () => {
        const loaded = loadThroughSaveManager(structuredClone(data));
        expect(loaded, `${file} loads`).not.toBeNull();
        expectValidState(loaded!.gameState, file);
      });

      it('keeps the progress it held', () => {
        const loaded = loadThroughSaveManager(structuredClone(data))!;
        const before = data.gameState as unknown as { phase: string; resources: Record<string, number> };
        expect(loaded.gameState.phase).toBe(before.phase);
        for (const [key, value] of Object.entries(before.resources)) {
          expect(loaded.gameState.resources[key as keyof GameState['resources']], `${file}: resources.${key}`).toBe(value);
        }
      });

      it('runs a tick after loading and still passes the state invariants', () => {
        const loaded = loadThroughSaveManager(structuredClone(data))!;
        const next = tickOnce(loaded.gameState);
        // Integers are not checked here: a tick from a fresh state leaves food
        // fractional too (ResourceSystem), which is not a save-loading matter.
        expectValidState(next, `${file} after one tick`, { integers: false });
      });
    });
  }
});
