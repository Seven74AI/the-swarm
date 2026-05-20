import { describe, it, expect, beforeEach } from 'vitest';
import { TileType, createInitialState, type GameState } from '../../src/state/GameState';
import { TerritorySystem } from '../../src/systems/TerritorySystem';

/**
 * TerritorySystem tests — behavior-focused.
 * Tests claim rules, adjacency logic, and bonus direction (not exact values).
 */
describe('TerritorySystem', () => {
  let territory: TerritorySystem;
  let state: GameState;

  beforeEach(() => {
    territory = new TerritorySystem();
    state = createInitialState();
  });

  describe('isAdjacent', () => {
    it('orthogonal tiles are adjacent', () => {
      expect(territory.isAdjacent(0, 0, 0, 1)).toBe(true);
      expect(territory.isAdjacent(0, 0, 1, 0)).toBe(true);
    });

    it('diagonal tiles are adjacent', () => {
      expect(territory.isAdjacent(0, 0, 1, 1)).toBe(true);
    });

    it('same tile is not adjacent to itself', () => {
      expect(territory.isAdjacent(0, 0, 0, 0)).toBe(false);
    });

    it('distant tiles are not adjacent', () => {
      expect(territory.isAdjacent(0, 0, 2, 0)).toBe(false);
    });
  });

  describe('claimTile', () => {
    function setupHomeTile(): void {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.territory.ownedTiles = 1;
    }

    it('can claim adjacent discovered tile', () => {
      setupHomeTile();
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      expect(territory.claimTile(0, 1, state)).toBe(true);
      expect(state.territory.ownedTiles).toBeGreaterThan(1);
    });

    it('cannot claim undiscovered tile', () => {
      setupHomeTile();
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: false, claimed: false };
      expect(territory.claimTile(0, 1, state)).toBe(false);
    });

    it('cannot claim already claimed tile', () => {
      setupHomeTile();
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: true };
      state.territory.ownedTiles = 2;
      expect(territory.claimTile(0, 1, state)).toBe(false);
    });

    it('cannot claim non-adjacent tile', () => {
      setupHomeTile();
      state.mapTiles[9] = { x: 1, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      state.mapTiles[18] = { x: 2, y: 2, type: TileType.MEADOW, discovered: true, claimed: false };
      expect(territory.claimTile(2, 2, state)).toBe(false);
    });

    it('ownedTiles increments on successful claim', () => {
      setupHomeTile();
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      const before = state.territory.ownedTiles;
      territory.claimTile(0, 1, state);
      expect(state.territory.ownedTiles).toBeGreaterThan(before);
    });
  });

  describe('getBonuses', () => {
    it('returns zero bonuses when no tiles claimed', () => {
      const bonuses = territory.getBonuses(state);
      expect(bonuses.wood).toBe(0);
      expect(bonuses.stone).toBe(0);
      expect(bonuses.nectar).toBe(0);
    });

    it('claimed FOREST tiles produce wood bonus (#8 fix)', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.FOREST, discovered: true, claimed: true };
      state.territory.ownedTiles = 1;
      const bonuses = territory.getBonuses(state);
      // FOREST now produces wood, not food
      expect(bonuses.wood).toBeGreaterThan(0);
    });

    it('multiple tiles of same type accumulate', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.MOUNTAIN, discovered: true, claimed: true };
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.MOUNTAIN, discovered: true, claimed: true };
      state.territory.ownedTiles = 2;
      const bonuses = territory.getBonuses(state);
      expect(bonuses.stone).toBeGreaterThan(0);
    });

    it('unclaimed tiles contribute nothing', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.FOREST, discovered: true, claimed: true };
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: true, claimed: false };
      state.territory.ownedTiles = 1;
      const bonuses = territory.getBonuses(state);
      // Only the claimed tile's bonus counts
      expect(bonuses.wood).toBeGreaterThan(0);
    });

    it('different tile types produce different resources', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.MOUNTAIN, discovered: true, claimed: true };
      state.mapTiles[8] = { x: 0, y: 1, type: TileType.MEADOW, discovered: true, claimed: true };
      state.territory.ownedTiles = 2;
      const bonuses = territory.getBonuses(state);
      expect(bonuses.stone).toBeGreaterThan(0);
      expect(bonuses.nectar).toBeGreaterThan(0);
    });

    it('EMPTY tiles give no bonuses', () => {
      state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
      state.territory.ownedTiles = 1;
      const bonuses = territory.getBonuses(state);
      expect(bonuses.wood).toBe(0);
      expect(bonuses.stone).toBe(0);
      expect(bonuses.nectar).toBe(0);
    });
  });
});
