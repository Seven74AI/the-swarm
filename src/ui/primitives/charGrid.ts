/**
 * The character grid (Story 1.31, UX-DR4, DESIGN.md → Layout & Spacing).
 *
 * Text panels sit on a monospace grid whose width is computed, never assumed:
 * `cols = floor(contentWidth / advanceWidth(body))`. The design target is 36
 * columns. From 28 to 35, meters shrink to `cols − 8` cells and two-column
 * rows stack; below 28 (large text or a narrow screen) box-drawing gives way
 * to 1 px CSS borders, text wraps, meters read `74 % ████····` and aligned
 * tables become label-over-value stacks. The grid is a layout aid and never a
 * reason to clip text.
 *
 * The shell measures (`ui/shell/charGrid.ts`) and writes `data-grid` on the
 * root for CSS; Preact components read the column count from
 * `CharGridContext` (by default `appGridCols`, which the App's grid writes).
 */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { signal, type ReadonlySignal, type Signal } from '@preact/signals-core';

/** The design target: panels render as designed from this many columns. */
export const DESIGN_COLS = 36;
/** Below this many columns box-drawing, aligned tables and bracketed meters give way. */
export const BOX_DRAWING_MIN_COLS = 28;
/** Columns a meter leaves for its label and percentage on a reduced grid. */
export const METER_GUTTER_COLS = 8;

export type GridClass = 'full' | 'medium' | 'narrow';

/** Whole columns of the body font that fit; a missing measurement counts as unlimited (the design). */
export function gridColumns(contentWidthPx: number, advancePx: number): number {
  if (!Number.isFinite(contentWidthPx) || !Number.isFinite(advancePx) || contentWidthPx <= 0 || advancePx <= 0) {
    return Infinity;
  }
  return Math.floor(contentWidthPx / advancePx);
}

export function gridClass(cols: number): GridClass {
  if (cols >= DESIGN_COLS) return 'full';
  if (cols >= BOX_DRAWING_MIN_COLS) return 'medium';
  return 'narrow';
}

/** A meter's cell count: as designed on the full grid, else `cols − 8` (at least 1, never more than designed). */
export function meterCellsFor(cols: number, designed: number): number {
  const top = Math.max(1, Math.floor(designed));
  if (gridClass(cols) === 'full') return top;
  return Math.max(1, Math.min(top, Math.floor(cols) - METER_GUTTER_COLS));
}

/**
 * The app's measured column count. The App's char grid writes it; the game's
 * UI is many Preact roots (one per host), so it is the context's default
 * rather than a provider value. Infinity (the full design) until measured.
 */
export const appGridCols: Signal<number> = signal(Infinity);

/** The column count components read; tests provide their own. */
export const CharGridContext = createContext<ReadonlySignal<number>>(appGridCols);

/** Read the column count in a component (re-renders when it changes). */
export function useGridCols(): number {
  return useContext(CharGridContext).value;
}
