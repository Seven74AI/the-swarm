import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { migrateSave } from '../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../src/platform/storage/SaveStore';
import { createInitialState, type GameState } from '../../src/state/GameState';

/**
 * Story 5.5 (save v33): LOG's lifetime BATTLES WON is its own tally,
 * `stats.totalBattlesWon`, because prestige now resets `battlesWon` (this
 * run's count, the Combat goal; Story 5.3). Before v33 prestige kept
 * `battlesWon`, so it is the save's lifetime count: the tally starts there.
 */
const FROM = 32;
const TO = 33;

function oldSave(battlesWon: unknown): SaveData {
  const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
  const { totalBattlesWon: _drop, ...stats } = s.stats as Record<string, unknown>;
  return { version: FROM, timestamp: 1, playTimeMs: 0, gameState: { ...s, battlesWon, stats } as unknown as GameState };
}

describe(`v${FROM} → v${TO}: the lifetime battles-won tally (Story 5.5)`, () => {
  afterEach(() => localStorage.clear());

  it('starts at the battles the save has won, and leaves this run\'s count alone', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), (won) => {
        const out = migrateSave(oldSave(won), FROM, TO);
        expect(out.version).toBe(TO);
        expect(out.gameState.stats.totalBattlesWon).toBe(won);
        expect(out.gameState.battlesWon).toBe(won);
      }),
      { numRuns: 50 },
    );
  });

  it('reads an unreadable count as 0 and keeps a tally already there', () => {
    expect(migrateSave(oldSave(Number.NaN), FROM, TO).gameState.stats.totalBattlesWon).toBe(0);
    expect(migrateSave(oldSave(-3), FROM, TO).gameState.stats.totalBattlesWon).toBe(0);
    const d = oldSave(2);
    (d.gameState.stats as unknown as Record<string, unknown>).totalBattlesWon = 40;
    expect(migrateSave(d, FROM, TO).gameState.stats.totalBattlesWon).toBe(40);
  });

  it('leaves a partial save without stats for the defaults', () => {
    const out = migrateSave({ version: FROM, timestamp: 1, playTimeMs: 0, gameState: { phase: 'colony' } as unknown as GameState }, FROM, TO);
    expect(out.version).toBe(TO);
    expect(out.gameState).toEqual({ phase: 'colony' });
  });

  it('an old save loads through SaveManager with the tally filled in', () => {
    localStorage.setItem('the_swarm_save', JSON.stringify(oldSave(9)));
    const loaded = new SaveManager(createLocalSaveStore(localStorage)).load();
    expect(loaded?.gameState.stats.totalBattlesWon).toBe(9);
  });
});
