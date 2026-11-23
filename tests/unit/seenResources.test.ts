import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';
import { prestige } from '../../src/systems/PrestigeSystem';
import { gameState } from '../../src/state/gameSignal';
import { testActions } from './helpers/actions';

/** Story 9.10: a resource's sheet row reads NEW once per resource per run. */
const initial = gameState.value;
afterEach(() => {
  gameState.value = initial;
});

describe('seenResources', () => {
  it('v36 → v37: an old save counts everything as seen (null); a save that has the list keeps it', () => {
    const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    delete s.seenResources;
    const old: SaveData = { version: 36, timestamp: 1, playTimeMs: 0, gameState: s as unknown as GameState };
    expect(migrateSave(old, 36, 37).gameState.seenResources).toBeNull();
    const kept: SaveData = { ...old, gameState: { ...old.gameState, seenResources: ['wood'] } };
    expect(migrateSave(kept, 36, 37).gameState.seenResources).toEqual(['wood']);
  });

  it('marking adds each id once, in one write; nothing new is refused', () => {
    const actions = testActions();
    gameState.value = createInitialState();
    const before = gameState.value.seenResources!;
    expect(actions.markResourcesSeen(['wood', 'stone', 'wood']).ok).toBe(true);
    expect(gameState.value.seenResources).toEqual([...before, 'wood', 'stone']);
    const after = gameState.value;
    expect(actions.markResourcesSeen(['wood']).ok).toBe(false);
    expect(gameState.value).toBe(after);
  });

  it('a new run starts over: prestige wipes the marks', () => {
    const s = { ...createInitialState(), seenResources: ['eggs', 'larvae', 'workers', 'food', 'wood', 'silk'] };
    expect(prestige(s).seenResources).toEqual(createInitialState().seenResources);
  });
});
