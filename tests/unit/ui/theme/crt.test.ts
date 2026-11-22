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

  /** The `--crt-px` the binding's stylesheet sets on `:root`, in CSS px. */
  const unitIn = (doc: Document): number => {
    const sheet = doc.querySelector('style[data-crt-px]');
    const m = /--crt-px:\s*([\d.]+)px/.exec(sheet?.textContent ?? '');
    return m ? parseFloat(m[1]) : Number.NaN;
  };

  it('sets the unit as --crt-px on :root in its own stylesheet, never inline, and follows pixel-ratio changes', () => {
    const doc = document.implementation.createHTMLDocument('crt');
    const { env, change, listeners } = fakeEnv(1.5);
    const dispose = bindScanlinePixels(doc, env);
    expect(unitIn(doc) * 1.5).toBeCloseTo(Math.round(unitIn(doc) * 1.5), 6);
    // The root keeps no inline style: the phase aliases' rule (phase-tokens.spec) holds.
    expect(doc.documentElement.getAttribute('style')).toBeNull();
    expect(doc.querySelectorAll('style[data-crt-px]')).toHaveLength(1);
    change(3);
    expect(unitIn(doc) * 3).toBeCloseTo(Math.round(unitIn(doc) * 3), 6);
    expect(doc.querySelectorAll('style[data-crt-px]')).toHaveLength(1);
    dispose();
    expect(listeners.size).toBe(0);
    expect(doc.querySelector('style[data-crt-px]')).toBeNull();
  });

  it('works without matchMedia', () => {
    const doc = document.implementation.createHTMLDocument('crt');
    const dispose = bindScanlinePixels(doc, { devicePixelRatio: 2 });
    expect(unitIn(doc)).toBeGreaterThan(0);
    dispose();
  });
});
