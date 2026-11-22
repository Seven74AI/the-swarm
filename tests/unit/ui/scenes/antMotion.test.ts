// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { antPose, tunnelPoint } from '../../../../src/ui/scenes/antMotion';
import { nestLayout, type ChamberGeometry, type Token } from '../../../../src/ui/scenes/nestLayout';
import { sceneBalance } from '../../../../src/data/balance/scene';

/**
 * Story 8.6 (AR14, N1): the individual ants move. `antPose(ant, tunnels, t)`
 * is a pure function of visual time: chamber ants sway in place, tunnel
 * walkers go along their tunnel and back. Invariants only.
 */

const layout = nestLayout({ eggs: 0, larvae: 0, workers: 5_000, starving: false });
const workers = layout.chambers.find((c) => c.id === 'workers')!;
const TIMES = Array.from({ length: 40 }, (_, i) => i * 997);

function inside(t: Token, c: ChamberGeometry): boolean {
  const dx = (t.x - c.cx) / c.rx;
  const dy = (t.y - c.cy) / c.ry;
  return dx * dx + dy * dy <= 1;
}

describe('antPose (Story 8.6)', () => {
  it('is pure: the same ant at the same time is in the same pose', () => {
    for (const a of layout.workers) expect(antPose(a, layout.tunnels, 1234)).toEqual(antPose({ ...a }, layout.tunnels, 1234));
  });

  it('sends some of the individual ants along the tunnels, and keeps the rest in their chamber', () => {
    const walkers = layout.workers.filter((a) => a.tunnel !== null);
    expect(walkers.length).toBeGreaterThan(0);
    expect(walkers.length).toBeLessThan(layout.workers.length);
    for (const a of walkers) expect(layout.tunnels.map((t) => t.id)).toContain(a.tunnel);
  });

  it('moves the ants as time passes', () => {
    for (const a of layout.workers) {
      const poses = TIMES.map((t) => antPose(a, layout.tunnels, t));
      expect(new Set(poses.map((p) => `${p.x},${p.y}`)).size).toBeGreaterThan(1);
    }
  });

  it('keeps a chamber ant inside its chamber at every moment', () => {
    for (const a of layout.workers.filter((w) => w.tunnel === null)) {
      for (const t of TIMES) expect(inside(antPose(a, layout.tunnels, t), workers)).toBe(true);
    }
  });

  it('keeps a walker on its tunnel: every pose is a point of the tunnel, facing along it', () => {
    for (const a of layout.workers.filter((w) => w.tunnel !== null)) {
      const tunnel = layout.tunnels.find((t) => t.id === a.tunnel)!;
      const samples = Array.from({ length: 201 }, (_, i) => tunnelPoint(tunnel, i / 200));
      for (const t of TIMES) {
        const p = antPose(a, layout.tunnels, t);
        const nearest = Math.min(...samples.map((s) => Math.hypot(s.x - p.x, s.y - p.y)));
        expect(nearest).toBeLessThan(1);
      }
    }
  });

  it('never moves more ants than the animation budget', () => {
    expect(layout.workers.length).toBeLessThanOrEqual(sceneBalance.animatedAntsMax);
  });
});

describe('wandering (Story 8.7)', () => {
  const still = layout.workers.filter((w) => w.tunnel === null);
  const LONG = Array.from({ length: 200 }, (_, i) => i * 211);

  it('lets a chamber ant wander: over time it covers ground in two directions, not one line', () => {
    for (const a of still) {
      const ps = LONG.map((t) => antPose(a, layout.tunnels, t));
      const xs = ps.map((p) => p.x);
      const ys = ps.map((p) => p.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1);
    }
  });

  it('wanders gently: never far from where it rests, and never fast', () => {
    for (const a of still) {
      for (const t of LONG) {
        const p = antPose(a, layout.tunnels, t);
        expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeLessThanOrEqual(sceneBalance.wanderReach * Math.SQRT2 + 0.1);
        const q = antPose(a, layout.tunnels, t + 100);
        // Under a tenth of the reach in a tenth of a second.
        expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeLessThan(sceneBalance.wanderReach / 10 + 0.2);
      }
    }
  });
});
