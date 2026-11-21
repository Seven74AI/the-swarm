import { TileType, type GameState, type Tile } from '../state/GameState';
import { rngStream, type RngStream } from '../utils/rng';

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
   * The layout is drawn from `rng` (the tick's stream, Story 3.1), or from the
   * game's generator (`state.rng`, advanced in the result) when none is given.
   * An explicit `seed` (tests) gives that seed's layout and leaves `state.rng` alone.
   * All tiles remain undiscovered and unclaimed after generation.
   */
  generateMap(state: GameState, seed?: number, stream?: RngStream): GameState {
    const own = seed !== undefined;
    const rng = own ? rngStream(seed) : (stream ?? rngStream(state.rng));
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

    return own ? { ...state, mapTiles: tiles } : { ...state, mapTiles: tiles, rng: rng.state };
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
  private pickWeightedType(rng: RngStream): TileType {
    let roll = rng.float() * TOTAL_WEIGHT;
    for (const [type, weight] of TILE_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return TileType.EMPTY;
  }
}
