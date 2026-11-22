/**
 * Scanline pixels (Story 8.4, UX-DR36): scanlines are drawn in device pixels
 * to avoid moiré on fractional-DPR screens. Their unit, `--crt-px` on
 * `:root`, is a whole number of device pixels near one CSS pixel; crt.css
 * draws every scanline in it. It is set by a stylesheet of its own
 * (`<style data-crt-px>`), never inline, so the root carries no inline style
 * (the phase aliases are only ever moved by its attribute). It follows
 * pixel-ratio changes (zoom, a move to another screen). Returns a disposer,
 * which removes the stylesheet.
 */

interface MediaWatch {
  addEventListener?(type: 'change', listener: () => void): void;
  removeEventListener?(type: 'change', listener: () => void): void;
}

/** The parts of `window` the binding reads; a plain object in tests. */
export interface PixelEnv {
  readonly devicePixelRatio?: number;
  readonly matchMedia?: (query: string) => MediaWatch;
}

/** One scanline unit in CSS px: the nearest whole number of device pixels (at least one). */
export function scanlinePx(dpr: number): number {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.max(1, Math.round(ratio)) / ratio;
}

export function bindScanlinePixels(doc: Document, env: PixelEnv = window): () => void {
  let watch: MediaWatch | null = null;
  const sheet = doc.createElement('style');
  sheet.setAttribute('data-crt-px', '');
  (doc.head ?? doc.documentElement).appendChild(sheet);
  const apply = () => {
    const dpr = env.devicePixelRatio ?? 1;
    sheet.textContent = `:root { --crt-px: ${scanlinePx(dpr)}px; }`;
    watch?.removeEventListener?.('change', apply);
    // A media query for the current ratio fires once the ratio changes.
    try {
      watch = typeof env.matchMedia === 'function' ? env.matchMedia(`(resolution: ${dpr}dppx)`) : null;
      watch?.addEventListener?.('change', apply);
    } catch {
      watch = null;
    }
  };
  apply();
  return () => {
    watch?.removeEventListener?.('change', apply);
    watch = null;
    sheet.remove();
  };
}
