import { describe, it, expect } from 'vitest';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';
import { createInitialState } from '../../src/state/GameState';

describe('migrateSave', () => {
  it('migrates v1 to v2 adding a new default field', () => {
    const state = createInitialState();
    const v1Data: SaveData = {
      version: 1,
      timestamp: 1234567890,
      playTimeMs: 5000,
      gameState: state,
    };

    const v2Data = migrateSave(v1Data, 1, 2);

    expect(v2Data.version).toBe(2);
    // v2 adds a 'population' field defaulting to workers count
    expect((v2Data.gameState as unknown as Record<string, unknown>).population).toBe(
      state.resources.workers,
    );
    expect(v2Data.timestamp).toBe(1234567890);
    expect(v2Data.playTimeMs).toBe(5000);
  });

  it('returns unchanged data when from equals to', () => {
    const state = createInitialState();
    const data: SaveData = {
      version: 1,
      timestamp: 0,
      playTimeMs: 0,
      gameState: state,
    };

    const result = migrateSave(data, 1, 1);
    expect(result).toEqual(data);
  });

  it('returns unchanged data when from > to', () => {
    const state = createInitialState();
    const data: SaveData = {
      version: 2,
      timestamp: 0,
      playTimeMs: 0,
      gameState: state,
    };

    const result = migrateSave(data, 2, 1);
    expect(result).toEqual(data);
  });
});
