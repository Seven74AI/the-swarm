import { describe, it, expect } from 'vitest';
import { bindScanlinePixels, scanlinePx } from '../../../../src/ui/theme/crt';

/**
 * Story 8.4 (UX-DR36): scanlines are drawn in device pixels to avoid moiré on
 * fractional-DPR screens. Their unit is a whole number of device pixels, close
 * to one CSS pixel, and it follows the screen's pixel ratio.
 */
describe('scanlinePx', () => {
  it('is a whole number of device pixels, at least one, near one CSS pixel', () => {
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.25, 2.625, 3, 3.5, 4]) {
      const css = scanlinePx(dpr);
      const device = css * dpr;
      expect(Math.abs(device - Math.round(device)), String(dpr)).toBeLessThan(1e-9);
      expect(Math.round(device), String(dpr)).toBeGreaterThanOrEqual(1);
      expect(css, String(dpr)).toBeGreaterThan(0.5);
      expect(css, String(dpr)).toBeLessThan(1.5);
    }
  });

  it('treats an unknown or broken pixel ratio as 1', () => {
    for (const dpr of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) expect(scanlinePx(dpr)).toBe(scanlinePx(1));
  });
});

describe('bindScanlinePixels', () => {
  function fakeEnv(initial: number) {
    const listeners = new Set<() => void>();
    const env = {
      devicePixelRatio: initial,
      matchMedia: (_q: string) => ({
        matches: true,
        addEventListener: (_t: 'change', l: () => void) => void listeners.add(l),
        removeEventListener: (_t: 'change', l: () => void) => void listeners.delete(l),
      }),
    };
    const change = (dpr: number) => {
      env.devicePixelRatio = dpr;
      for (const l of Array.from(listeners)) l();
    };
    return { env, change, listeners };
  }

  it('writes the unit onto the root as --crt-px and follows pixel-ratio changes', () => {
    const root = document.createElement('div');
    const { env, change, listeners } = fakeEnv(1.5);
    const dispose = bindScanlinePixels(root, env);
    const unit = () => parseFloat(root.style.getPropertyValue('--crt-px'));
    expect(unit() * 1.5).toBeCloseTo(Math.round(unit() * 1.5), 6);
    change(3);
    expect(unit() * 3).toBeCloseTo(Math.round(unit() * 3), 6);
    dispose();
    expect(listeners.size).toBe(0);
  });

  it('works without matchMedia', () => {
    const root = document.createElement('div');
    const dispose = bindScanlinePixels(root, { devicePixelRatio: 2 });
    expect(root.style.getPropertyValue('--crt-px')).toMatch(/px$/);
    dispose();
  });
});
