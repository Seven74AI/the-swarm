import { describe, it, expect, beforeEach } from 'vitest';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { createInitialState, TileType, type GameState } from '../../src/state/GameState';

describe('TerritorySystem', () => {
  let territory: TerritorySystem;
  let map: MapSystem;
  let state: GameState;

  beforeEach(() => {
    territory = new TerritorySystem();
    map = new MapSystem();
    state = createInitialState();
  });

  describe('claimTile', () => {
    it('claims a discovered tile adjacent to owned territory', () => {
      // Discover tile (0,1) — index = 1*8+0 = 8
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      // Mark (0,0) as claimed (home tile) — index = 0*8+0 = 0
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.territory.ownedTiles = 1;

      const result = territory.claimTile(0, 1, state);
      expect(result).toBe(true);
      expect(state.mapTiles[8].claimed).toBe(true);
      expect(state.territory.ownedTiles).toBe(2);
    });

    it('rejects claim on undiscovered tile', () => {
      // (0,0) is owned but (0,1) is undiscovered
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.territory.ownedTiles = 1;

      const result = territory.claimTile(0, 1, state);
      expect(result).toBe(false);
      expect(state.mapTiles[1].claimed).toBe(false);
    });

    it('rejects claim when no adjacent owned territory', () => {
      // No owned tiles
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.FOREST, discovered: true, claimed: false };

      const result = territory.claimTile(0, 0, state);
      expect(result).toBe(false);
    });

    it('rejects claim on already-claimed tile', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.territory.ownedTiles = 1;

      const result = territory.claimTile(0, 0, state);
      expect(result).toBe(false);
      expect(state.territory.ownedTiles).toBe(1);
    });

    it('rejects claim on out-of-bounds coordinates', () => {
      const result = territory.claimTile(-1, 0, state);
      expect(result).toBe(false);
    });

    it('allows claim when tile is adjacent diagonally', () => {
      // (0,0) owned, claim (1,1) — diagonal adjacency
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.mapTiles[9] = { x: 1, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      state.territory.ownedTiles = 1;

      const result = territory.claimTile(1, 1, state);
      expect(result).toBe(true);
    });

    it('allows chain claiming (newly claimed tile enables next)', () => {
      // (0,0) owned, claim (0,1), then (0,2)
      // index: (0,0)=0, (0,1)=8, (0,2)=16
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      state.mapTiles[16] = { x: 0, y: 2, type: TileType.MOUNTAIN, discovered: true, claimed: false };
      state.territory.ownedTiles = 1;

      expect(territory.claimTile(0, 1, state)).toBe(true);
      expect(territory.claimTile(0, 2, state)).toBe(true);
      expect(state.territory.ownedTiles).toBe(3);
    });
  });

  describe('getBonuses', () => {
    it('returns zero bonuses when no tiles claimed', () => {
      const bonuses = territory.getBonuses(state);
      expect(bonuses.food).toBe(0);
      expect(bonuses.stone).toBe(0);
      expect(bonuses.nectar).toBe(0);
    });

    it('accumulates FOREST bonus as +0.1 food/worker per tile', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.FOREST, discovered: true, claimed: true };
      state.mapTiles[1] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: true };
      state.territory.ownedTiles = 2;

      const bonuses = territory.getBonuses(state);
      expect(bonuses.food).toBeCloseTo(0.2); // 2 FOREST × 0.1
      expect(bonuses.stone).toBe(0);
      expect(bonuses.nectar).toBe(0);
    });

    it('accumulates MOUNTAIN bonus as +0.1 stone/worker per tile', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.MOUNTAIN, discovered: true, claimed: true };
      state.mapTiles[1] = { x: 0, y: 1, type: TileType.MOUNTAIN, discovered: true, claimed: true };
      state.mapTiles[2] = { x: 0, y: 2, type: TileType.MOUNTAIN, discovered: true, claimed: true };
      state.territory.ownedTiles = 3;

      const bonuses = territory.getBonuses(state);
      expect(bonuses.stone).toBeCloseTo(0.3); // 3 MOUNTAIN × 0.1
      expect(bonuses.food).toBe(0);
      expect(bonuses.nectar).toBe(0);
    });

    it('accumulates MEADOW bonus as +0.1 nectar/worker per tile', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.MEADOW, discovered: true, claimed: true };
      state.territory.ownedTiles = 1;

      const bonuses = territory.getBonuses(state);
      expect(bonuses.nectar).toBeCloseTo(0.1);
    });

    it('EMPTY and ENEMY_NEST tiles contribute no bonuses', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.mapTiles[1] = { x: 0, y: 1, type: TileType.ENEMY_NEST, discovered: true, claimed: true };
      state.territory.ownedTiles = 2;

      const bonuses = territory.getBonuses(state);
      expect(bonuses.food).toBe(0);
      expect(bonuses.stone).toBe(0);
      expect(bonuses.nectar).toBe(0);
    });

    it('accumulates mixed territory bonuses correctly', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.FOREST, discovered: true, claimed: true };
      state.mapTiles[1] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: true };
      state.mapTiles[2] = { x: 0, y: 2, type: TileType.MOUNTAIN, discovered: true, claimed: true };
      state.mapTiles[3] = { x: 0, y: 3, type: TileType.MEADOW, discovered: true, claimed: true };
      state.territory.ownedTiles = 4;

      const bonuses = territory.getBonuses(state);
      expect(bonuses.food).toBeCloseTo(0.2);   // 2 FOREST
      expect(bonuses.stone).toBeCloseTo(0.1);  // 1 MOUNTAIN
      expect(bonuses.nectar).toBeCloseTo(0.1); // 1 MEADOW
    });

    it('ignores unclaimed tiles', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.FOREST, discovered: true, claimed: true };
      state.mapTiles[1] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      state.territory.ownedTiles = 1;

      const bonuses = territory.getBonuses(state);
      expect(bonuses.food).toBeCloseTo(0.1); // only 1 claimed FOREST
    });
  });

  describe('isAdjacent', () => {
    it('returns true for orthogonally adjacent tiles', () => {
      expect(territory.isAdjacent(0, 0, 0, 1)).toBe(true);
      expect(territory.isAdjacent(0, 0, 1, 0)).toBe(true);
      expect(territory.isAdjacent(2, 3, 3, 3)).toBe(true);
    });

    it('returns true for diagonally adjacent tiles', () => {
      expect(territory.isAdjacent(0, 0, 1, 1)).toBe(true);
      expect(territory.isAdjacent(2, 2, 1, 1)).toBe(true);
    });

    it('returns false for non-adjacent tiles', () => {
      expect(territory.isAdjacent(0, 0, 0, 2)).toBe(false);
      expect(territory.isAdjacent(0, 0, 2, 0)).toBe(false);
      expect(territory.isAdjacent(0, 0, 2, 2)).toBe(false);
    });

    it('returns false for same tile', () => {
      expect(territory.isAdjacent(0, 0, 0, 0)).toBe(false);
    });
  });
});
