// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ANT_AREA, BROOD_AREA, nestLayout, type ChamberGeometry, type NestLayout, type Token } from '../../../../src/ui/scenes/nestLayout';
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
      expect(l.workers.length).toBeLessThanOrEqual(sceneBalance.animatedAntsMax);
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

/** The dots of a cloud path: one `M x y h s v s h -s z` square each. */
function dots(d: string): { x: number; y: number; s: number }[] {
  return [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h([\d.]+)v[\d.]+h-[\d.]+z/g)].map((m) => ({ x: +m[1], y: +m[2], s: +m[3] }));
}

const chamberOf = (l: NestLayout, id: string): ChamberGeometry => l.chambers.find((c) => c.id === id)!;

/** What the worker chamber's ants would cover if every one were drawn, as a share of its area. */
const workerCoverage = (l: NestLayout, workers: number) => (workers * ANT_AREA) / chamberOf(l, 'workers').area;

describe('nestLayout: the dot cloud (Story 8.6)', () => {
  it('draws every ant of a chamber whose ants cover no more than the threshold, with no cloud', () => {
    const l = nestLayout(view(0, 0, 0));
    let n = 1;
    while (workerCoverage(l, n + 1) <= sceneBalance.cloudCoverage && n + 1 <= sceneBalance.animatedAntsMax) n++;
    const small = nestLayout(view(0, 0, n));
    expect(small.workers.length).toBe(n);
    expect(chamberOf(small, 'workers').cloud.count).toBe(0);
    expect(chamberOf(small, 'workers').cloud.d).toBe('');
  });

  it('turns the extras into a cloud once the ants would cover more than the threshold', () => {
    const l = nestLayout(view(0, 0, 0));
    let n = 1;
    while (workerCoverage(l, n) <= sceneBalance.cloudCoverage) n++;
    const big = nestLayout(view(0, 0, n));
    expect(chamberOf(big, 'workers').cloud.count).toBeGreaterThan(0);
    expect(dots(chamberOf(big, 'workers').cloud.d).length).toBeGreaterThan(0);
  });

  it('keeps 30 to 50 individual ants on top of a cloud, and counts every ant once: drawn or in the cloud', () => {
    for (const workers of [500, 5_000, 1_000_000]) {
      const l = nestLayout(view(0, 0, workers));
      const cloud = chamberOf(l, 'workers').cloud;
      expect(cloud.count).toBeGreaterThan(0);
      expect(l.workers.length).toBeGreaterThanOrEqual(sceneBalance.cloudAntsMin);
      expect(l.workers.length).toBeLessThanOrEqual(sceneBalance.animatedAntsMax);
      expect(l.workers.length + cloud.count).toBe(workers);
    }
  });

  it('never animates more than the budget of ants in the whole scene, whatever the colony', () => {
    fc.assert(
      fc.property(fc.nat(10_000_000), fc.nat(10_000_000), fc.nat(10_000_000), (eggs, larvae, workers) => {
        const l = nestLayout(view(eggs, larvae, workers));
        expect(l.workers.length).toBeLessThanOrEqual(sceneBalance.animatedAntsMax);
        expect(l.workers.length + chamberOf(l, 'workers').cloud.count).toBe(workers);
        expect(l.eggs.length + l.larvae.length + chamberOf(l, 'brood').cloud.count).toBe(eggs + larvae);
      }),
      { numRuns: 60 },
    );
  });

  it('draws a cloud as one path of small dots (1 to 1.5 units), all inside its chamber, never more than the cap', () => {
    const l = nestLayout(view(20_000, 9_000, 2_000_000));
    for (const c of l.chambers) {
      const ds = dots(c.cloud.d);
      expect(ds.length).toBeGreaterThan(0);
      expect(ds.length).toBeLessThanOrEqual(sceneBalance.cloudDotsMax);
      expect(ds.length).toBeLessThanOrEqual(c.cloud.count);
      for (const p of ds) {
        expect(p.s).toBeGreaterThanOrEqual(1);
        expect(p.s).toBeLessThanOrEqual(1.5);
        expect(inside({ x: p.x + p.s / 2, y: p.y + p.s / 2, angle: 0 }, c)).toBe(true);
      }
    }
  });

  it('keeps every dot where it was as the cloud grows', () => {
    const before = dots(chamberOf(nestLayout(view(0, 0, 300)), 'workers').cloud.d);
    const after = dots(chamberOf(nestLayout(view(0, 0, 400)), 'workers').cloud.d);
    expect(after.length).toBeGreaterThan(before.length);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('clouds the brood the same way: past the threshold, the extra eggs and larvae become dots', () => {
    const brood = chamberOf(nestLayout(view(0, 0, 0)), 'brood');
    let eggs = 1;
    while ((eggs * BROOD_AREA.egg) / brood.area <= sceneBalance.cloudCoverage) eggs++;
    expect(chamberOf(nestLayout(view(eggs - 1, 0, 0)), 'brood').cloud.count).toBe(0);
    const l = nestLayout(view(eggs * 10, eggs * 10, 0));
    expect(chamberOf(l, 'brood').cloud.count).toBeGreaterThan(0);
    expect(l.eggs.length).toBeGreaterThan(0);
    expect(l.larvae.length).toBeGreaterThan(0);
    const covered = l.eggs.length * BROOD_AREA.egg + l.larvae.length * BROOD_AREA.larva;
    expect(covered / chamberOf(l, 'brood').area).toBeLessThanOrEqual(sceneBalance.cloudCoverage);
  });
});
