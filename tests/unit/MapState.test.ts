import { describe, it, expect } from 'vitest';
import { createInitialState, TileType } from '../../src/state/GameState';

describe('Phase 3 map state', () => {
  it('TileType enum has expected values', () => {
    expect(TileType.EMPTY).toBe('empty');
    expect(TileType.FOREST).toBe('forest');
    expect(TileType.MOUNTAIN).toBe('mountain');
    expect(TileType.MEADOW).toBe('meadow');
    expect(TileType.ENEMY_NEST).toBe('enemy_nest');
  });

  it('initial state has 64 map tiles (8x8 grid)', () => {
    const state = createInitialState();
    expect(state.mapTiles).toBeDefined();
    expect(state.mapTiles).toHaveLength(64);
  });

  it('all tiles start undiscovered and unclaimed', () => {
    const state = createInitialState();
    for (const tile of state.mapTiles) {
      expect(tile.discovered).toBe(false);
      expect(tile.claimed).toBe(false);
    }
  });

  it('map tiles cover coordinates 0-7 for both x and y', () => {
    const state = createInitialState();
    const coords = new Set(state.mapTiles.map(t => `${t.x},${t.y}`));
    expect(coords.size).toBe(64);
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        expect(coords.has(`${x},${y}`)).toBe(true);
      }
    }
  });

  it('each tile has a valid type', () => {
    const state = createInitialState();
    const validTypes = new Set(Object.values(TileType));
    for (const tile of state.mapTiles) {
      expect(validTypes.has(tile.type)).toBe(true);
    }
  });
});
