import { describe, it, expect, beforeEach } from 'vitest';
import { MapSystem } from '../../src/systems/MapSystem';
import { createInitialState, TileType, type GameState } from '../../src/state/GameState';

describe('MapSystem', () => {
  let system: MapSystem;
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    system = new MapSystem();
  });

  describe('getTile', () => {
    it('returns a tile at valid coordinates', () => {
      const tile = system.getTile(state, 0, 0);
      expect(tile).toBeDefined();
      expect(tile!.x).toBe(0);
      expect(tile!.y).toBe(0);
    });

    it('returns undefined for out-of-bounds coordinates', () => {
      expect(system.getTile(state, -1, 0)).toBeUndefined();
      expect(system.getTile(state, 0, -1)).toBeUndefined();
      expect(system.getTile(state, 8, 0)).toBeUndefined();
      expect(system.getTile(state, 0, 8)).toBeUndefined();
    });
  });

  describe('generateMap', () => {
    it('assigns tile types and produces a valid grid', () => {
      const result = system.generateMap(state);
      expect(result.mapTiles).toHaveLength(64);

      const types = result.mapTiles.map(t => t.type);
      // Should have a mix of types
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(3); // at least few types
    });

    it('all tiles remain undiscovered and unclaimed after generation', () => {
      const result = system.generateMap(state);
      for (const tile of result.mapTiles) {
        expect(tile.discovered).toBe(false);
        expect(tile.claimed).toBe(false);
      }
    });

    it('produces deterministic results with same seed', () => {
      const a = system.generateMap(state, 42);
      const b = system.generateMap(state, 42);
      for (let i = 0; i < 64; i++) {
        expect(a.mapTiles[i].type).toBe(b.mapTiles[i].type);
      }
    });

    it('produces different results with different seeds', () => {
      const results = new Set<string>();
      for (let seed = 0; seed < 5; seed++) {
        const result = system.generateMap(state, seed);
        const types = result.mapTiles.map(t => t.type).join(',');
        results.add(types);
      }
      // With 5 different seeds and 5+ tile types, should get >1 unique layout
      expect(results.size).toBeGreaterThan(1);
    });

    it('includes all tile types across multiple seeds', () => {
      const allTypes = new Set<string>();
      for (let seed = 0; seed < 100; seed++) {
        const result = system.generateMap(state, seed);
        for (const tile of result.mapTiles) {
          allTypes.add(tile.type);
        }
        if (allTypes.size >= 5) break;
      }
      expect(allTypes.has(TileType.EMPTY)).toBe(true);
      expect(allTypes.has(TileType.FOREST)).toBe(true);
      expect(allTypes.has(TileType.MOUNTAIN)).toBe(true);
      expect(allTypes.has(TileType.MEADOW)).toBe(true);
      expect(allTypes.has(TileType.ENEMY_NEST)).toBe(true);
    });
  });

  describe('discoverTile', () => {
    it('reveals an undiscovered tile', () => {
      // Set up a tile
      state.mapTiles[0].type = TileType.FOREST;
      const result = system.discoverTile(state, 0, 0);
      expect(result).toBe(true);
      expect(system.isDiscovered(state, 0, 0)).toBe(true);
    });

    it('returns false for already-discovered tile', () => {
      state.mapTiles[0].discovered = true;
      const result = system.discoverTile(state, 0, 0);
      expect(result).toBe(false);
    });

    it('returns false for out-of-bounds coordinates', () => {
      const result = system.discoverTile(state, -1, 0);
      expect(result).toBe(false);
    });
  });

  describe('isDiscovered', () => {
    it('returns false for undiscovered tiles', () => {
      expect(system.isDiscovered(state, 0, 0)).toBe(false);
    });

    it('returns true for discovered tiles', () => {
      state.mapTiles[0].discovered = true;
      expect(system.isDiscovered(state, 0, 0)).toBe(true);
    });

    it('returns false for out-of-bounds coordinates', () => {
      expect(system.isDiscovered(state, -1, 0)).toBe(false);
    });
  });

  describe('getTileType', () => {
    it('returns tile type for valid coordinates', () => {
      state.mapTiles[0].type = TileType.MOUNTAIN;
      expect(system.getTileType(state, 0, 0)).toBe(TileType.MOUNTAIN);
    });

    it('returns undefined for out-of-bounds coordinates', () => {
      expect(system.getTileType(state, -1, 0)).toBeUndefined();
    });
  });

  describe('GRID_SIZE', () => {
    it('exposes 8 as grid size', () => {
      expect(MapSystem.GRID_SIZE).toBe(8);
    });
  });
});
