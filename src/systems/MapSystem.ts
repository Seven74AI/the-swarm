import { TileType, type GameState, type Tile } from '../state/GameState';

/**
 * Simple seeded PRNG (mulberry32).
 * Returns a function that produces deterministic random numbers in [0, 1).
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted tile distribution for map generation. */
const TILE_WEIGHTS: [TileType, number][] = [
  [TileType.EMPTY, 30],
  [TileType.FOREST, 25],
  [TileType.MOUNTAIN, 15],
  [TileType.MEADOW, 20],
  [TileType.ENEMY_NEST, 10],
];

const TOTAL_WEIGHT = TILE_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

/**
 * MapSystem manages the 8×8 map grid: generation, fog of war, and discovery.
 * Pure logic — no DOM access.
 */
export class MapSystem {
  static readonly GRID_SIZE = 8;

  /**
   * Get a tile at coordinates (x, y). Returns undefined if out of bounds.
   */
  getTile(state: GameState, x: number, y: number): Tile | undefined {
    if (x < 0 || x >= MapSystem.GRID_SIZE || y < 0 || y >= MapSystem.GRID_SIZE) {
      return undefined;
    }
    return state.mapTiles[y * MapSystem.GRID_SIZE + x];
  }

  /**
   * Generate the map layout using a weighted random distribution.
   * Optional seed for deterministic generation (testing / seeded runs).
   * All tiles remain undiscovered and unclaimed after generation.
   */
  generateMap(state: GameState, seed?: number): GameState {
    const rng = mulberry32(seed ?? Math.floor(Math.random() * 2147483647));
    const tiles: Tile[] = [];

    for (let y = 0; y < MapSystem.GRID_SIZE; y++) {
      for (let x = 0; x < MapSystem.GRID_SIZE; x++) {
        tiles.push({
          x,
          y,
          type: this.pickWeightedType(rng),
          discovered: false,
          claimed: false,
        });
      }
    }

    return {
      ...state,
      mapTiles: tiles,
    };
  }

  /**
   * Discover (reveal) a tile at (x, y).
   * Returns true if the tile was newly discovered, false if already revealed or out of bounds.
   */
  discoverTile(state: GameState, x: number, y: number): boolean {
    if (x < 0 || x >= MapSystem.GRID_SIZE || y < 0 || y >= MapSystem.GRID_SIZE) {
      return false;
    }

    const index = y * MapSystem.GRID_SIZE + x;
    if (!state.mapTiles[index] || state.mapTiles[index].discovered) {
      return false;
    }

    state.mapTiles[index] = { ...state.mapTiles[index], discovered: true };
    return true;
  }

  /**
   * Check if a tile has been discovered.
   */
  isDiscovered(state: GameState, x: number, y: number): boolean {
    const tile = this.getTile(state, x, y);
    return tile ? tile.discovered : false;
  }

  /**
   * Get the tile type at (x, y). Returns undefined if out of bounds.
   */
  getTileType(state: GameState, x: number, y: number): TileType | undefined {
    const tile = this.getTile(state, x, y);
    return tile?.type;
  }

  /**
   * Pick a weighted random tile type using the given RNG.
   */
  private pickWeightedType(rng: () => number): TileType {
    let roll = rng() * TOTAL_WEIGHT;
    for (const [type, weight] of TILE_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return TileType.EMPTY;
  }
}
