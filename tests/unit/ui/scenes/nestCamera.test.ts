// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CAMERA_CLOSE, cameraRect, cameraStep, cameraZoom, chamberAnchor, MIN_STAGE_PX, type Rect } from '../../../../src/ui/scenes/nestCamera';
import { ANT_LENGTH, nestLayout } from '../../../../src/ui/scenes/nestLayout';
import { sceneBalance } from '../../../../src/data/balance/scene';

/**
 * Story 8.7 (UX-DR34): the nest's camera. It steps back from 2× to 1.5× to
 * 1× as the colony crosses the thresholds in `sceneBalance.cameraSteps`, as
 * the `zoom` the scene takes (Story 8.9: 1 = close, below 1 pulled back), and
 * never draws a worker under `antMinPx`. Invariants only: the thresholds and
 * zooms come from scene.ts.
 */

const steps = sceneBalance.cameraSteps;
const zoomOf = (workers: number, previous: number | null = null) => steps[cameraStep(workers, previous)].zoom;
const layout = nestLayout({ eggs: 3, larvae: 2, workers: 10, starving: false });
const contains = (r: Rect, p: { x: number; y: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

describe('cameraStep (Story 8.7)', () => {
  it('starts close and pulls back as the colony crosses each threshold', () => {
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].workers).toBeGreaterThan(steps[i - 1].workers);
      expect(steps[i].zoom).toBeLessThan(steps[i - 1].zoom);
      expect(zoomOf(steps[i].workers - 1)).toBe(steps[i - 1].zoom);
      expect(zoomOf(steps[i].workers)).toBe(steps[i].zoom);
    }
    expect(zoomOf(0)).toBe(steps[0].zoom);
    expect(zoomOf(10_000_000)).toBe(steps[steps.length - 1].zoom);
  });

  it('never zooms in as the colony grows', () => {
    fc.assert(
      fc.property(fc.nat(1_000), fc.nat(1_000), (a, b) => {
        const [small, big] = a <= b ? [a, b] : [b, a];
        expect(zoomOf(big)).toBeLessThanOrEqual(zoomOf(small));
      }),
    );
  });

  it('does not pump at a threshold: a colony hovering just under it keeps the wider view', () => {
    for (let i = 1; i < steps.length; i++) {
      const out = cameraStep(steps[i].workers, null);
      expect(cameraStep(steps[i].workers - 1, out)).toBe(out);
      // Far enough under it, the camera comes back in.
      expect(cameraStep(steps[i - 1].workers, out)).toBeLessThan(out);
    }
  });
});

describe('cameraZoom (Story 8.7)', () => {
  it('is the scene prop: 1 for the closest step, below 1 and falling for each step back', () => {
    expect(cameraZoom(0)).toBe(1);
    for (let i = 1; i < steps.length; i++) {
      expect(cameraZoom(i)).toBeLessThan(cameraZoom(i - 1));
      expect(cameraZoom(i)).toBeGreaterThan(0);
      expect(cameraZoom(i) * CAMERA_CLOSE).toBeCloseTo(steps[i].zoom);
    }
  });
});

describe('cameraRect (Story 8.7)', () => {
  it('shows the whole scene at 1×, and a part of it, inside the scene, closer in', () => {
    const whole = cameraRect(layout, 1);
    expect(whole).toEqual({ x: 0, y: 0, w: layout.width, h: layout.height });
    for (const s of steps) {
      const r = cameraRect(layout, s.zoom);
      expect(r.w).toBeCloseTo(layout.width / s.zoom);
      expect(r.h).toBeCloseTo(layout.height / s.zoom);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(layout.width + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(layout.height + 1e-9);
    }
  });

  it('keeps the queen and the brood in view at every step', () => {
    const brood = layout.chambers.find((c) => c.id === 'brood')!;
    for (const s of steps) {
      const r = cameraRect(layout, s.zoom);
      expect(contains(r, layout.queen)).toBe(true);
      expect(contains(r, { x: brood.cx, y: brood.cy })).toBe(true);
    }
  });

  it('keeps every chamber label anchor inside the stage, whatever the camera', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 2, noNaN: true }), (zoom) => {
        const r = cameraRect(layout, zoom);
        for (const c of layout.chambers) {
          const a = chamberAnchor(c, layout, r);
          expect(a.x).toBeGreaterThanOrEqual(0);
          expect(a.x).toBeLessThanOrEqual(1);
          expect(a.y).toBeGreaterThanOrEqual(0);
          expect(a.y).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it('never draws an individual worker under the minimum on a stage at its narrowest', () => {
    const farthest = Math.min(...steps.map((s) => s.zoom));
    expect((ANT_LENGTH * farthest * MIN_STAGE_PX) / layout.width).toBeGreaterThanOrEqual(sceneBalance.antMinPx);
  });
});
