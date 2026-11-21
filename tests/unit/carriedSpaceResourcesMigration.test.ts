import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';
import { migrateSave } from '../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../src/platform/storage/SaveStore';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { PHASE_ORDER, Phase } from '../../src/phases/phases';

/**
 * Story 5.4 (FR30): saves from before Story 5.3 carried void crystals,
 * antimatter, dark matter and survey data across prestige. A run that has
 * prestiged and hasn't reached Space can only hold them by carrying them
 * over, so this step sets them to 0. A run in Space or Transcendence, or a
 * save that never prestiged, keeps them. This file pins its own step.
 */
const FROM = 31;
const TO = 32;

const SPACE_KEYS = ['voidCrystals', 'antimatter', 'darkMatter', 'surveyData'] as const;
const BEFORE_SPACE = PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(Phase.SPACE));
const FROM_SPACE = PHASE_ORDER.slice(PHASE_ORDER.indexOf(Phase.SPACE));

function oldSave(phase: string, count: number, amounts: Record<(typeof SPACE_KEYS)[number], number>): SaveData {
  const s = structuredClone(createInitialState());
  return {
    version: FROM,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: {
      ...s,
      phase,
      resources: { ...s.resources, ...amounts },
      prestige: { ...s.prestige, count, legacyPoints: 9, lifetimeLpEarned: 30 },
      prestigeTree: { purchased: ['egg_laying_bonus'] },
      victoryAchieved: true,
      stats: { ...s.stats, totalEggsLaid: 500, totalClicks: 200, playTimeMs: 1000 },
    },
  };
}

const amounts = fc.record({
  voidCrystals: fc.integer({ min: 1, max: 10_000 }),
  antimatter: fc.integer({ min: 1, max: 10_000 }),
  darkMatter: fc.integer({ min: 1, max: 10_000 }),
  surveyData: fc.integer({ min: 1, max: 10_000 }),
});

const migrated = (d: SaveData): GameState => migrateSave(d, FROM, TO).gameState;

/** What the step must never touch: LP, Legacy upgrades, lifetime stats, the victory record. */
function expectRecordKept(before: GameState, after: GameState): void {
  expect(after.prestige).toEqual(before.prestige);
  expect(after.prestigeTree).toEqual(before.prestigeTree);
  // Later steps may add a stat (v33: the lifetime battles tally); none the save held changes.
  expect(after.stats).toMatchObject(before.stats);
  // Later steps may add to the lifetime record (v34: phasesCompleted); nothing it held changes.
  expect(after.lifetime).toMatchObject(before.lifetime);
  expect(after.victoryAchieved).toBe(before.victoryAchieved);
}

describe(`v${FROM} → v${TO}: space resources carried across prestige (Story 5.4, FR30)`, () => {
  afterEach(() => localStorage.clear());

  it('bumps the version', () => {
    expect(migrateSave(oldSave(Phase.COLONY, 1, { voidCrystals: 1, antimatter: 1, darkMatter: 1, surveyData: 1 }), FROM, TO).version).toBe(TO);
  });

  it('a prestiged run before Space loses what it carried; nothing else changes', () => {
    fc.assert(
      fc.property(fc.constantFrom(...BEFORE_SPACE), fc.integer({ min: 1, max: 50 }), amounts, (phase, count, a) => {
        const d = oldSave(phase, count, a);
        const out = migrated(structuredClone(d));
        for (const k of SPACE_KEYS) expect(out.resources[k], k).toBe(0);
        const rest = (s: GameState) => {
          const { voidCrystals: _v, antimatter: _a, darkMatter: _d, surveyData: _s, ...r } = s.resources;
          return r;
        };
        expect(rest(out)).toEqual(rest(d.gameState));
        expect(out.phase).toBe(phase);
        expectRecordKept(d.gameState, out);
      }),
      { numRuns: 60 },
    );
  });

  it('a run in Space or Transcendence keeps its space resources', () => {
    fc.assert(
      fc.property(fc.constantFrom(...FROM_SPACE), fc.integer({ min: 1, max: 50 }), amounts, (phase, count, a) => {
        const d = oldSave(phase, count, a);
        expect(migrated(structuredClone(d))).toEqual(d.gameState);
      }),
      { numRuns: 30 },
    );
  });

  it('a save that never prestiged keeps its space resources, whatever its phase', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PHASE_ORDER), amounts, (phase, a) => {
        const d = oldSave(phase, 0, a);
        expect(migrated(structuredClone(d))).toEqual(d.gameState);
      }),
      { numRuns: 30 },
    );
  });

  it('leaves a partial save without resources or prestige for the defaults', () => {
    const d = { version: FROM, timestamp: 1, playTimeMs: 0, gameState: { phase: 'colony' } as unknown as GameState };
    const out = migrateSave(d, FROM, TO);
    expect(out.version).toBe(TO);
    expect(out.gameState).toEqual({ phase: 'colony' });
  });

  describe('the fixtures', () => {
    const dir = path.join(__dirname, '..', 'saves');
    const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as SaveData;
    const load = (d: SaveData) => {
      localStorage.setItem('the_swarm_save', JSON.stringify(d));
      return new SaveManager(createLocalSaveStore(localStorage)).load()!.gameState;
    };

    it(`v${FROM}.json is a prestiged run before Space that carried space resources: they load as 0`, () => {
      const d = read(`v${FROM}.json`);
      expect(d.version).toBe(FROM);
      expect(d.gameState.prestige.count).toBeGreaterThan(0);
      expect(BEFORE_SPACE).toContain(d.gameState.phase);
      for (const k of SPACE_KEYS) expect(d.gameState.resources[k], k).toBeGreaterThan(0);
      const out = load(d);
      for (const k of SPACE_KEYS) expect(out.resources[k], k).toBe(0);
      expectRecordKept(d.gameState, out);
    });

    it(`v${FROM}_space.json is a prestiged run in Space: its space resources load unchanged`, () => {
      const d = read(`v${FROM}_space.json`);
      expect(d.version).toBe(FROM);
      expect(d.gameState.prestige.count).toBeGreaterThan(0);
      expect(FROM_SPACE).toContain(d.gameState.phase);
      const out = load(d);
      for (const k of SPACE_KEYS) expect(out.resources[k], k).toBe(d.gameState.resources[k]);
      expectRecordKept(d.gameState, out);
    });
  });
});
