import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { migrateSave } from '../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../src/persistence/SaveManager';
import { createLocalSaveStore } from '../../src/platform/storage/SaveStore';
import { Phase } from '../../src/phases/phases';

/** Story 9.2: v34 → v35 adds the dig state and never lowers the nest capacity. */
describe('v34 → v35: the dig state', () => {
  const FROM = 34;
  const TO = 35;
  afterEach(() => localStorage.clear());

  function oldSave(nestCapacity: number, capacityAccumulator = 7): SaveData {
    const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    delete s.dig;
    return {
      version: FROM,
      timestamp: 1,
      playTimeMs: 0,
      gameState: {
        ...s,
        phase: Phase.COLONY,
        capacityAccumulator,
        resources: { ...(s.resources as object), nestCapacity },
      } as unknown as GameState,
    };
  }

  it('starts digging at the first room, with no progress and no carry, and drops the old accumulator', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), (cap) => {
        const gs = migrateSave(oldSave(cap), FROM, TO).gameState;
        expect(gs.dig.roomsDug).toBe(0);
        expect(gs.dig.progress).toBe(0);
        expect(gs.dig.carry).toBe(0);
        expect('capacityAccumulator' in gs).toBe(false);
      }),
    );
  });

  it('never lowers the nest capacity the save had', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), (cap) => {
        expect(migrateSave(oldSave(cap), FROM, TO).gameState.resources.nestCapacity).toBe(cap);
      }),
    );
  });

  it('keeps a dig state already there', () => {
    const d = oldSave(100);
    const withDig = { ...d, gameState: { ...d.gameState, dig: { roomsDug: 3, progress: 40, carry: 0.5 } } as GameState };
    expect(migrateSave(withDig, FROM, TO).gameState.dig).toEqual({ roomsDug: 3, progress: 40, carry: 0.5 });
  });

  it('an old save loads through SaveManager with the dig state filled in', () => {
    localStorage.setItem('the_swarm_save', JSON.stringify(oldSave(200)));
    const loaded = new SaveManager(createLocalSaveStore(localStorage)).load()!;
    expect(loaded.gameState.resources.nestCapacity).toBe(200);
    expect(loaded.gameState.dig).toEqual({ roomsDug: 0, progress: 0, carry: 0 });
  });
});
