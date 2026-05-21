import { TileType, type GameState } from '../state/GameState';

/** Bonus multipliers: per-worker bonus per claimed tile of each resource type. */
const BONUS_PER_TILE: Record<string, number> = {
  [TileType.FOREST]: 0.5,  // +0.5 wood/tick per worker
  [TileType.MOUNTAIN]: 0.5, // +0.5 stone/tick per worker
  [TileType.MEADOW]: 0.5,   // +0.5 nectar/tick per worker
};

export interface TerritoryBonuses {
  food: number;
  stone: number;
  nectar: number;
  wood: number;
}

/**
 * TerritorySystem handles tile claiming and zone bonus calculation.
 * Pure logic — no DOM access.
 */
export class TerritorySystem {
  /**
   * Check if two tiles are adjacent (8-directional: orthogonal + diagonal).
   */
  isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
    if (x1 === x2 && y1 === y2) return false;
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return dx <= 1 && dy <= 1;
  }

  /**
   * Claim a tile at (x, y). The tile must be:
   * 1. Within bounds (0–7)
   * 2. Discovered
   * 3. Not already claimed
   * 4. Adjacent to at least one already-owned tile
   *
   * Returns true if the claim succeeded, false otherwise.
   */
  claimTile(x: number, y: number, state: GameState): boolean {
    const GRID = 8;

    if (x < 0 || x >= GRID || y < 0 || y >= GRID) {
      return false;
    }

    const index = y * GRID + x;
    const tile = state.mapTiles[index];
    if (!tile) return false;
    if (!tile.discovered) return false;
    if (tile.claimed) return false;

    // Check adjacency to owned territory
    let hasAdjacentOwned = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
          const neighbor = state.mapTiles[ny * GRID + nx];
          if (neighbor.claimed) {
            hasAdjacentOwned = true;
            break;
          }
        }
      }
      if (hasAdjacentOwned) break;
    }

    if (!hasAdjacentOwned) return false;

    // Claim it
    state.mapTiles[index] = { ...tile, claimed: true };
    state.territory.ownedTiles++;

    return true;
  }

  /**
   * Calculate territory bonuses from all claimed tiles.
   * Returns per-worker multipliers: FOREST → food, MOUNTAIN → stone, MEADOW → nectar.
   */
  getBonuses(state: GameState): TerritoryBonuses {
    let food = 0;
    let stone = 0;
    let nectar = 0;
    let wood = 0;

    for (const tile of state.mapTiles) {
      if (!tile.claimed) continue;
      const bonus = BONUS_PER_TILE[tile.type];
      if (!bonus) continue;

      switch (tile.type) {
        case TileType.FOREST:
          wood += bonus;
          break;
        case TileType.MOUNTAIN:
          stone += bonus;
          break;
        case TileType.MEADOW:
          nectar += bonus;
          break;
      }
    }

    return { food, stone, nectar, wood };
  }
}
