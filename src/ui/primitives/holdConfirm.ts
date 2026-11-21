/**
 * Hold-to-confirm timing and ring shape for `HoldToConfirm` (Story 1.13, UX-DR21).
 *
 * UI feel, not game balance. The hold duration itself is a player setting
 * (`confirmHoldMs`, Story 1.10) passed in from main; only its shape lives here.
 */

/** Cells in the square ring that fills over a hold. */
export const RING_CELLS = 8;

/** How long a first tap stays armed in two-tap mode. */
export const ARM_MS = 5000;

/** A draining ring empties at this many times the fill speed. */
export const DRAIN_SPEED = 2;

export interface RingCell {
  readonly row: number;
  readonly col: number;
}

/**
 * The ring as cells of a 3×3 grid without its centre, in fill order:
 * clockwise from the top-left corner.
 */
export const RING_ORDER: readonly RingCell[] = Object.freeze([
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 2 },
  { row: 2, col: 2 },
  { row: 2, col: 1 },
  { row: 2, col: 0 },
  { row: 1, col: 0 },
]);

/** Whole cells filled after holding for `heldMs` of a `holdMs` hold. */
export function cellsFilled(heldMs: number, holdMs: number): number {
  if (holdMs <= 0) return RING_CELLS;
  return Math.min(RING_CELLS, Math.max(0, Math.floor((heldMs * RING_CELLS) / holdMs)));
}

/** Whole ms into a `holdMs` hold at which cell `n` (1-based) fills; cell RING_CELLS fills at `holdMs`. */
export function cellTimeMs(n: number, holdMs: number): number {
  return Math.ceil((n * holdMs) / RING_CELLS);
}

/** Delay between two cells of a draining ring. */
export function drainStepMs(holdMs: number): number {
  return Math.max(1, Math.floor(holdMs / RING_CELLS / DRAIN_SPEED));
}
