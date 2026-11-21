import { describe, it, expect } from 'vitest';
import { BAR_CELLS, roleBar } from '../../../../src/ui/wrkr/roleBar';

/** Story 1.23 / DESIGN.md "Role row": `█` per worker up to 16 cells, then scaled; `·` for empty. */
describe('roleBar', () => {
  it('draws one filled cell per worker while the workforce fits', () => {
    for (let total = 0; total <= BAR_CELLS; total++) {
      for (let count = 0; count <= total; count++) {
        const bar = roleBar(count, total);
        expect(bar.filled).toBe(count);
        expect(bar.filled + bar.empty).toBe(total);
      }
    }
  });

  it('scales past the cell limit, never wider than the limit', () => {
    const total = BAR_CELLS * 7 + 3;
    let last = -1;
    for (let count = 0; count <= total; count++) {
      const bar = roleBar(count, total);
      expect(bar.filled + bar.empty).toBe(BAR_CELLS);
      expect(bar.filled).toBeGreaterThanOrEqual(last);
      last = bar.filled;
    }
    expect(roleBar(0, total).filled).toBe(0);
    expect(roleBar(1, total).filled).toBeGreaterThan(0);
    expect(roleBar(total, total).filled).toBe(BAR_CELLS);
  });

  it('copes with a count above the total and bad input', () => {
    expect(roleBar(5, 3).filled).toBe(3);
    expect(roleBar(-2, 3).filled).toBe(0);
    expect(roleBar(Number.NaN, 3)).toEqual({ filled: 0, empty: 3 });
  });
});
