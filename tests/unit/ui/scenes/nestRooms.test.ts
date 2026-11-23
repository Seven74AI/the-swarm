// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ANT_LENGTH, MIN_STAGE_PX, crackPath, nestLayout, type NestLayout } from '../../../../src/ui/scenes/nestLayout';
import { sceneBalance } from '../../../../src/data/balance/scene';
import type { NestView } from '../../../../src/state/nestView';

/**
 * Story 9.6 (FR59, UX-DR34, AR14): the scene draws only the rooms dug so far
 * and frames the whole dug nest. Invariants over a range of room counts.
 */
const view = (roomsDug: number): NestView => ({ eggs: 3, larvae: 2, workers: 10, starving: false, roomsDug });
const ROOMS = [0, 1, 2, 5, 9, 10, 17, 30, 60, 120];
/** The narrowest phone (320 px) less the shell's side margins. */
const PHONE_STAGE_PX = 320 - 2 * 14;

const inFrame = (l: NestLayout, e: { cx: number; cy: number; rx: number; ry: number }) =>
  e.cx - e.rx >= 0 && e.cx + e.rx <= l.width && e.cy - e.ry >= l.surfaceY && e.cy + e.ry <= l.height;

describe('nestLayout: only the rooms dug (Story 9.6)', () => {
  it('draws the queen and brood chamber, the workers chamber and one room per room dug', () => {
    for (const n of ROOMS) {
      const l = nestLayout(view(n));
      expect(l.chambers.map((c) => c.id)).toEqual(['brood', 'workers']);
      expect(l.rooms).toHaveLength(n);
    }
  });

  it('frames the whole dug nest: no chamber or room is cropped, at any room count', () => {
    for (const n of ROOMS) {
      const l = nestLayout(view(n));
      for (const c of [...l.chambers, ...l.rooms]) expect(inFrame(l, c), `${n} rooms`).toBe(true);
    }
  });

  it('a drawn worker is never under the minimum on a 320 px phone, at any room count', () => {
    expect(MIN_STAGE_PX).toBeLessThanOrEqual(PHONE_STAGE_PX);
    for (const n of ROOMS) {
      const l = nestLayout(view(n));
      expect((ANT_LENGTH * PHONE_STAGE_PX) / l.width).toBeGreaterThanOrEqual(sceneBalance.antMinPx);
    }
  });

  it('a new room opens the picture: the frame never shrinks, and the rooms already dug keep their place', () => {
    let last = nestLayout(view(0));
    for (let n = 1; n <= 40; n++) {
      const l = nestLayout(view(n));
      expect(l.height).toBeGreaterThanOrEqual(last.height);
      expect(l.width).toBe(last.width);
      expect(l.rooms.slice(0, n - 1)).toEqual(last.rooms);
      last = l;
    }
  });

  it('rooms never overlap each other or the founding chambers', () => {
    const l = nestLayout(view(60));
    const all = [...l.chambers, ...l.rooms];
    // Each room against every other room and both founding chambers (those two already touch).
    for (let i = 0; i < all.length; i++) {
      for (let j = Math.max(i + 1, l.chambers.length); j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const apart = Math.abs(a.cx - b.cx) >= a.rx + b.rx || Math.abs(a.cy - b.cy) >= a.ry + b.ry;
        expect(apart, `${i} vs ${j}`).toBe(true);
      }
    }
  });

  it('digs the next room at its own place: the dig face sits where room n opens, and the crack starts there', () => {
    for (const n of [0, 3, 12]) {
      const l = nestLayout(view(n));
      const next = nestLayout(view(n + 1)).rooms[n];
      expect(l.digFace).toEqual({ x: next.cx, y: next.cy });
      expect(crackPath(2, l.digFace)).toMatch(new RegExp(`^M${next.cx} ${next.cy}`));
    }
  });

  it('every room is reached by a tunnel', () => {
    const l = nestLayout(view(25));
    for (const r of l.rooms) {
      const reached = l.tunnels.some((t) => t.curve.some((p) => Math.abs(p.x - r.cx) <= r.rx && Math.abs(p.y - r.cy) <= r.ry));
      expect(reached).toBe(true);
    }
  });
});
