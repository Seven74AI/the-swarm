/**
 * Meter primitive (Story 1.12, DESIGN.md → Rows, cards and meters).
 *
 * `[████████······]  74%`: filled cells in `accent`, empty in `edge`. The
 * typed cells and the percentage are decoration, hidden from assistive tech;
 * the element itself is a `progressbar` whose `aria-valuetext` the caller
 * writes in words ("Workers 37 of 50").
 *
 * On a reduced character grid (Story 1.31, UX-DR4) it shrinks to `cols − 8`
 * cells; below 28 columns it reads `74 % ████····` (`data-meter-form="short"`):
 * percentage first, no brackets, free to wrap.
 */
import { gridClass, meterCellsFor, useGridCols } from './charGrid';
import './Meter.css';
export const METER_CELLS = 14;

/** Filled and empty cell counts; filled never exceeds what the value earns (floor). */
export function meterCells(value: number, max: number, cells: number = METER_CELLS): { filled: number; empty: number } {
  const total = Math.max(0, Math.floor(cells));
  const ratio = max > 0 && Number.isFinite(value) ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = Math.floor(ratio * total);
  return { filled, empty: total - filled };
}

export interface MeterProps {
  readonly value: number;
  readonly max: number;
  /** The words a screen reader says, e.g. "Workers 37 of 50". */
  readonly valueText: string;
  readonly cells?: number;
  /** Draw the fill in `warn` (entropy above 75 %). */
  readonly warn?: boolean;
  /** `[` `]` around the cells (default). The condensed goal meter draws them bare (Story 1.18). */
  readonly brackets?: boolean;
  readonly class?: string;
}

export function Meter({ value, max, valueText, cells = METER_CELLS, warn = false, brackets = true, class: cls }: MeterProps) {
  const cols = useGridCols();
  const short = gridClass(cols) === 'narrow';
  const top = Math.max(0, Math.floor(max));
  const now = Math.min(top, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
  const { filled, empty } = meterCells(now, top, meterCellsFor(cols, cells));
  const pct = top > 0 ? Math.floor((now / top) * 100) : 0;
  const bar = (
    <span data-meter-cells="" class="meter__cells">
      <span class="meter__fill">{'█'.repeat(filled)}</span>
      <span class="meter__empty">{'·'.repeat(empty)}</span>
    </span>
  );
  return (
    <div
      class={cls ? `meter ${cls}` : 'meter'}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={top}
      aria-valuenow={now}
      aria-valuetext={valueText}
      data-warn={warn ? '' : undefined}
      data-meter-form={short ? 'short' : 'bar'}
    >
      {short ? (
        <>
          <span aria-hidden="true" data-meter-pct="" class="meter__pct">
            {`${pct} %`}
          </span>{' '}
          <span aria-hidden="true" class="meter__bar">
            {bar}
          </span>
        </>
      ) : (
        <>
          <span aria-hidden="true" class="meter__bar">
            {brackets ? '[' : null}
            {bar}
            {brackets ? ']' : null}
          </span>{' '}
          <span aria-hidden="true" data-meter-pct="" class="meter__pct">
            {pct}%
          </span>
        </>
      )}
    </div>
  );
}
