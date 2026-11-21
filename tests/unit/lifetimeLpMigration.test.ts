import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { migrateSave } from '../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../src/platform/storage/SaveStore';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { PRESTIGE_UPGRADES, type PrestigeUpgradeId } from '../../src/data/prestigeTree';
import { productionMultiplier, productionMultiplierFor } from '../../src/engine/ProgressionCurve';
import { PHASE_ORDER } from '../../src/phases/phases';

/**
 * Story 5.2 (FR29): the save step that adds `prestige.lifetimeLpEarned`. An
 * old save starts it at the LP held plus the LP its bought Legacy nodes cost,
 * so loading never lowers the production bonus. This file pins its own step.
 */
const FROM = 27;
const TO = 28;

const IDS = PRESTIGE_UPGRADES.map((u) => u.id);

/** A save from before the step: the prestige block has no lifetimeLpEarned. */
function oldSave(legacyPoints: unknown, purchased: unknown, over: Record<string, unknown> = {}): SaveData {
  const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
  const { lifetimeLpEarned: _drop, ...prestige } = s.prestige as Record<string, unknown>;
  return {
    version: FROM,
    timestamp: 1_700_000_000_000,
    playTimeMs: 0,
    gameState: { ...s, ...over, prestige: { ...prestige, legacyPoints }, prestigeTree: { purchased } } as unknown as GameState,
  };
}
const lifetime = (d: SaveData): number => migrateSave(d, FROM, TO).gameState.prestige.lifetimeLpEarned;

describe(`v${FROM} → v${TO}: lifetime LP earned (Story 5.2, FR29)`, () => {
  it('bumps the version', () => {
    expect(migrateSave(oldSave(0, []), FROM, TO).version).toBe(TO);
  });

  it('with no Legacy nodes bought, lifetime LP is the LP held', () => {
    for (const lp of [0, 3, 120]) expect(lifetime(oldSave(lp, []))).toBe(lp);
  });

  it('each bought node adds the whole, positive LP it cost, and they add up', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), fc.subarray(IDS), (lp, bought) => {
        const total = lifetime(oldSave(lp, bought));
        const each = bought.map((id) => lifetime(oldSave(lp, [id])) - lp);
        for (const c of each) expect(Number.isInteger(c) && c > 0).toBe(true);
        expect(total).toBe(lp + each.reduce((a, b) => a + b, 0));
      }),
      { numRuns: 100 },
    );
  });

  it('never lowers the production bonus the save had (it was computed from LP held)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), fc.subarray(IDS), fc.constantFrom(...PHASE_ORDER), (lp, bought, phase) => {
        const out = migrateSave(oldSave(lp, bought, { phase }), FROM, TO).gameState;
        expect(productionMultiplierFor(out)).toBeGreaterThanOrEqual(productionMultiplier(phase, lp));
      }),
      { numRuns: 100 },
    );
  });

  it('ignores unknown or repeated node ids and unreadable LP', () => {
    const one = IDS[0] as PrestigeUpgradeId;
    expect(lifetime(oldSave(5, ['no_such_node']))).toBe(5);
    expect(lifetime(oldSave(5, [one, one]))).toBe(lifetime(oldSave(5, [one])));
    expect(lifetime(oldSave(Number.NaN, []))).toBe(0);
    expect(lifetime(oldSave(-4, []))).toBe(0);
    expect(lifetime(oldSave(2.7, []))).toBe(2);
    expect(lifetime(oldSave(5, 'garbage'))).toBe(5);
  });

  it('keeps a lifetime value already at least the LP held plus spent', () => {
    const d = oldSave(5, []);
    (d.gameState.prestige as unknown as Record<string, unknown>).lifetimeLpEarned = 40;
    expect(lifetime(d)).toBe(40);
  });

  it('a partial save without a prestige block is left for the defaults', () => {
    const out = migrateSave({ version: FROM, timestamp: 1, playTimeMs: 0, gameState: { phase: 'colony' } as unknown as GameState }, FROM, TO);
    expect(out.version).toBe(TO);
    expect(out.gameState).toEqual({ phase: 'colony' });
  });

  it('an old save loads through SaveManager with lifetime LP filled in', () => {
    localStorage.clear();
    const d = { ...oldSave(7, [IDS[0]]), lastSeenAt: 1_700_000_000_000 };
    localStorage.setItem('the_swarm_save', JSON.stringify(d));
    const loaded = new SaveManager(createLocalSaveStore(localStorage)).load();
    expect(loaded?.gameState.prestige.lifetimeLpEarned).toBeGreaterThan(7);
    localStorage.clear();
  });
});
