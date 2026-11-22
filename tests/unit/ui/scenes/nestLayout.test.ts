// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nestLayout, type ChamberGeometry, type Token } from '../../../../src/ui/scenes/nestLayout';
import { sceneBalance } from '../../../../src/data/balance/scene';
import type { NestView } from '../../../../src/state/nestView';

/**
 * Story 8.5 (AR14, N1): `nestLayout(view)` is a pure, deterministic function
 * of the view. Invariants only: same view, same layout; never more drawn
 * creatures than the colony holds; every creature inside its chamber.
 */

const view = (eggs: number, larvae: number, workers: number): NestView => ({ eggs, larvae, workers });

function inside(t: Token, c: ChamberGeometry): boolean {
  const dx = (t.x - c.cx) / c.rx;
  const dy = (t.y - c.cy) / c.ry;
  return dx * dx + dy * dy <= 1;
}

describe('nestLayout (Story 8.5)', () => {
  it('is deterministic: the same view gives the same layout, whatever was laid out before', () => {
    const a = view(5, 4, 37);
    const first = nestLayout(a);
    nestLayout(view(900, 3, 12_000));
    expect(nestLayout({ ...a })).toEqual(first);
  });

  it('never reads more than its view, and never changes it', () => {
    const v = Object.freeze(view(3, 2, 26));
    expect(() => nestLayout(v)).not.toThrow();
    expect(v).toEqual(view(3, 2, 26));
  });

  it('draws one queen and never more eggs, larvae or workers than the colony holds', () => {
    for (const v of [view(0, 0, 0), view(1, 1, 1), view(7, 3, 12), view(10_000, 5_000, 1_000_000)]) {
      const l = nestLayout(v);
      expect(l.queen).toBeDefined();
      expect(l.eggs.length).toBeLessThanOrEqual(v.eggs);
      expect(l.larvae.length).toBeLessThanOrEqual(v.larvae);
      expect(l.workers.length).toBeLessThanOrEqual(v.workers);
      expect(l.eggs.length).toBeLessThanOrEqual(sceneBalance.drawnEggsMax);
      expect(l.larvae.length).toBeLessThanOrEqual(sceneBalance.drawnLarvaeMax);
      expect(l.workers.length).toBeLessThanOrEqual(sceneBalance.drawnWorkersMax);
    }
  });

  it('draws every creature of a small colony', () => {
    const l = nestLayout(view(2, 1, 3));
    expect([l.eggs.length, l.larvae.length, l.workers.length]).toEqual([2, 1, 3]);
  });

  it('puts the queen, eggs and larvae in the brood chamber and the workers in theirs', () => {
    const l = nestLayout(view(30, 30, 500));
    const brood = l.chambers.find((c) => c.id === 'brood')!;
    const workers = l.chambers.find((c) => c.id === 'workers')!;
    expect(inside(l.queen, brood)).toBe(true);
    for (const t of [...l.eggs, ...l.larvae]) expect(inside(t, brood)).toBe(true);
    for (const t of l.workers) expect(inside(t, workers)).toBe(true);
  });

  it('keeps every creature where it was when one more arrives', () => {
    const before = nestLayout(view(3, 2, 10));
    const after = nestLayout(view(4, 3, 11));
    expect(after.eggs.slice(0, 3)).toEqual(before.eggs);
    expect(after.larvae.slice(0, 2)).toEqual(before.larvae);
    expect(after.workers.slice(0, 10)).toEqual(before.workers);
  });

  it('lays out soil with strata, pebbles and a grass line, and tunnels joining the surface to each chamber', () => {
    const l = nestLayout(view(1, 1, 1));
    expect(l.strata.length).toBeGreaterThan(0);
    expect(l.pebbles.length).toBeGreaterThan(0);
    expect(l.grass).toMatch(/^M/);
    expect(l.surfaceY).toBeGreaterThan(0);
    expect(l.surfaceY).toBeLessThan(l.height);
    expect(l.tunnels.length).toBeGreaterThanOrEqual(l.chambers.length);
    for (const c of l.chambers) {
      expect(c.cy - c.ry).toBeGreaterThan(l.surfaceY);
      expect(c.cx - c.rx).toBeGreaterThanOrEqual(0);
      expect(c.cx + c.rx).toBeLessThanOrEqual(l.width);
      expect(c.cy + c.ry).toBeLessThanOrEqual(l.height);
    }
  });

  it('anchors each chamber label inside the scene', () => {
    for (const c of nestLayout(view(1, 1, 1)).chambers) {
      expect(c.label.x).toBeGreaterThanOrEqual(0);
      expect(c.label.x).toBeLessThanOrEqual(1);
      expect(c.label.y).toBeGreaterThanOrEqual(0);
      expect(c.label.y).toBeLessThanOrEqual(1);
    }
  });
});
