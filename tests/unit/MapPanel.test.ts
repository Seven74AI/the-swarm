import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapPanel } from '../../src/ui/panels/MapPanel';
import { MapSystem } from '../../src/systems/MapSystem';
import { createInitialState, TileType, type GameState } from '../../src/state/GameState';

describe('MapPanel', () => {
  let panel: MapPanel;
  let mapSystem: MapSystem;
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    mapSystem = new MapSystem();
    state = mapSystem.generateMap(state, 42);
    panel = new MapPanel(mapSystem, () => state, (s) => { state = s; });
  });

  describe('getElement', () => {
    it('returns a container with map-panel class', () => {
      const el = panel.getElement();
      expect(el.classList.contains('map-panel')).toBe(true);
    });

    it('contains a canvas element', () => {
      const el = panel.getElement();
      const canvas = el.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    it('canvas has 480x480 default size', () => {
      const el = panel.getElement();
      const canvas = el.querySelector('canvas')!;
      expect(canvas.width).toBe(480);
      expect(canvas.height).toBe(480);
    });

    it('contains a summary bar with territory count', () => {
      const el = panel.getElement();
      const summary = el.querySelector('.map-summary');
      expect(summary).not.toBeNull();
      expect(summary!.textContent).toContain('Territory');
      expect(summary!.textContent).toContain('0');
    });

    it('returns the same element on repeated calls', () => {
      const el1 = panel.getElement();
      const el2 = panel.getElement();
      expect(el1).toBe(el2);
    });
  });

  describe('update', () => {
    it('does not throw when called without canvas context', () => {
      panel.getElement();
      // jsdom canvas has getContext('2d') returning null, update should be safe
      expect(() => panel.update()).not.toThrow();
    });

    it('updates territory count in summary', () => {
      state.territory.ownedTiles = 5;
      const el = panel.getElement();
      panel.update();
      const summary = el.querySelector('.map-summary');
      expect(summary!.textContent).toContain('5');
    });

    it('shows zero territory correctly', () => {
      state.territory.ownedTiles = 0;
      const el = panel.getElement();
      panel.update();
      const summary = el.querySelector('.map-summary');
      expect(summary!.textContent).toContain('0');
    });
  });

  describe('click handling', () => {
    it('calls onTileClick with correct coordinates', () => {
      const clicks: { x: number; y: number }[] = [];
      panel.onTileClick = (x, y) => clicks.push({ x, y });

      const el = panel.getElement();
      const canvas = el.querySelector('canvas')!;

      // Mock bounding rect: 480px canvas, tile size = 60
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 480, bottom: 480,
        width: 480, height: 480,
        x: 0, y: 0,
        toJSON: () => ({}),
      });

      // Click at (30, 30) → tile (0, 0)
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 30, clientY: 30 }));
      expect(clicks).toHaveLength(1);
      expect(clicks[0]).toEqual({ x: 0, y: 0 });
    });

    it('calls onTileClick with correct coordinates for interior tile', () => {
      const clicks: { x: number; y: number }[] = [];
      panel.onTileClick = (x, y) => clicks.push({ x, y });

      const el = panel.getElement();
      const canvas = el.querySelector('canvas')!;

      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 480, bottom: 480,
        width: 480, height: 480,
        x: 0, y: 0,
        toJSON: () => ({}),
      });

      // Click at (210, 210) → tile (3, 3) at tileSize=60
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 210, clientY: 210 }));
      expect(clicks).toHaveLength(1);
      expect(clicks[0]).toEqual({ x: 3, y: 3 });
    });

    it('ignores click when onTileClick is null', () => {
      panel.onTileClick = null;
      const el = panel.getElement();
      const canvas = el.querySelector('canvas')!;

      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 480, bottom: 480,
        width: 480, height: 480,
        x: 0, y: 0,
        toJSON: () => ({}),
      });

      expect(() =>
        canvas.dispatchEvent(new MouseEvent('click', { clientX: 30, clientY: 30 }))
      ).not.toThrow();
    });
  });
});
