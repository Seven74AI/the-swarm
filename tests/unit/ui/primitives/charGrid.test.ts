import { describe, it, expect } from 'vitest';
import {
  DESIGN_COLS,
  BOX_DRAWING_MIN_COLS,
  gridColumns,
  gridClass,
  meterCellsFor,
} from '../../../../src/ui/primitives/charGrid';

/** Story 1.31 (UX-DR4): the character grid is computed, `cols = floor(contentWidth / advanceWidth(body))`. */
describe('character grid', () => {
  it('counts whole columns, and a missing measurement means the design grid', () => {
    for (const [width, advance] of [[300, 9.6], [304, 19.2], [600, 7], [36, 1]]) {
      const cols = gridColumns(width, advance);
      expect(Number.isInteger(cols)).toBe(true);
      expect(cols * advance).toBeLessThanOrEqual(width);
      expect((cols + 1) * advance).toBeGreaterThan(width);
    }
    for (const [width, advance] of [[0, 0], [300, 0], [NaN, 8], [300, -1], [300, Infinity]]) {
      expect(gridClass(gridColumns(width, advance))).toBe('full');
    }
  });

  it('is the full design from 36 columns, medium from 28, narrow below', () => {
    expect(DESIGN_COLS).toBeGreaterThan(BOX_DRAWING_MIN_COLS);
    expect(gridClass(DESIGN_COLS)).toBe('full');
    expect(gridClass(DESIGN_COLS + 20)).toBe('full');
    expect(gridClass(DESIGN_COLS - 1)).toBe('medium');
    expect(gridClass(BOX_DRAWING_MIN_COLS)).toBe('medium');
    expect(gridClass(BOX_DRAWING_MIN_COLS - 1)).toBe('narrow');
    expect(gridClass(0)).toBe('narrow');
  });

  it('keeps a meter as designed on the full grid and shrinks it to cols − 8 below', () => {
    const designed = 14;
    expect(meterCellsFor(DESIGN_COLS, designed)).toBe(designed);
    expect(meterCellsFor(Infinity, designed)).toBe(designed);
    for (let cols = 0; cols < DESIGN_COLS; cols++) {
      const cells = meterCellsFor(cols, designed);
      expect(Number.isInteger(cells)).toBe(true);
      expect(cells).toBeGreaterThanOrEqual(1);
      expect(cells).toBeLessThanOrEqual(designed);
      if (cols - 8 >= 1) expect(cells).toBeLessThanOrEqual(cols - 8);
    }
    // Never wider than designed, however many columns there are.
    expect(meterCellsFor(DESIGN_COLS - 1, 5)).toBeLessThanOrEqual(5);
  });
});
