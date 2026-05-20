import { TileType, type GameState } from '../../state/GameState';
import type { MapSystem } from '../../systems/MapSystem';

/** Color map for each tile type. */
const TILE_COLORS: Record<string, string> = {
  [TileType.EMPTY]: '#c8b88a',
  [TileType.FOREST]: '#2d5a1e',
  [TileType.MOUNTAIN]: '#6b6b6b',
  [TileType.MEADOW]: '#7ec845',
  [TileType.ENEMY_NEST]: '#8b0000',
};

const FOG_COLOR = '#3a3a3a';
const CLAIMED_BORDER_COLOR = '#ffd700';
const GRID_LINE_COLOR = '#555555';
const GRID = 8;

/**
 * MapPanel renders the 8×8 territory map on a canvas.
 * Supports tile discovery (fog of war), claimed borders, and click selection.
 */
export class MapPanel {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private summary: HTMLElement | null = null;
  private tileSize = 0;

  /** Called when the user clicks a tile. */
  onTileClick: ((x: number, y: number) => void) | null = null;

  constructor(
    private mapSystem: MapSystem,
    private getState: () => GameState,
    private setState: (s: GameState) => void,
  ) {}

  getElement(): HTMLElement {
    if (this.container) return this.container;

    this.container = document.createElement('div');
    this.container.className = 'map-panel';

    // Summary bar
    this.summary = document.createElement('div');
    this.summary.className = 'map-summary';
    this.summary.textContent = 'Territory: 0 tiles';
    this.container.appendChild(this.summary);

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.canvas.width = 480;
    this.canvas.height = 480;
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    // Click handler
    this.canvas.addEventListener('click', (e) => {
      if (!this.canvas || !this.onTileClick) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mx = e.offsetX * scaleX;
      const my = e.offsetY * scaleY;

      const tileSize = this.canvas.width / GRID;
      const tx = Math.floor(mx / tileSize);
      const ty = Math.floor(my / tileSize);

      if (tx >= 0 && tx < GRID && ty >= 0 && ty < GRID) {
        this.onTileClick(tx, ty);
      }
    });

    // Initial draw
    this.update();

    return this.container;
  }

  /** Re-render the map from current state. */
  update(): void {
    const state = this.getState();

    // Always update summary, even without canvas context
    if (this.summary) {
      this.summary.textContent = `Territory: ${state.territory.ownedTiles} tiles`;
    }

    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const tileSize = this.canvas.width / GRID;
    this.tileSize = tileSize;

    // Clear
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw tiles
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const index = y * GRID + x;
        const tile = state.mapTiles[index];
        const px = x * tileSize;
        const py = y * tileSize;

        if (tile.discovered) {
          // Fill with tile color
          ctx.fillStyle = TILE_COLORS[tile.type] || TILE_COLORS[TileType.EMPTY];
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);

          // Claimed border
          if (tile.claimed) {
            ctx.strokeStyle = CLAIMED_BORDER_COLOR;
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
          }
        } else {
          // Fog of war
          ctx.fillStyle = FOG_COLOR;
          ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        }

        // Grid lines
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, tileSize, tileSize);
      }
    }
  }
}
