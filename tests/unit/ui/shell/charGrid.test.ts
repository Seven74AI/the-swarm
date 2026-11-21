import { describe, it, expect, afterEach } from 'vitest';
import { createCharGrid } from '../../../../src/ui/shell/charGrid';
import { BOX_DRAWING_MIN_COLS, DESIGN_COLS } from '../../../../src/ui/primitives/charGrid';

/**
 * Story 1.31 (UX-DR4): the shell measures its content column and the body
 * font's advance, and marks the root with the grid class CSS keys off.
 */
describe('createCharGrid', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-grid');
    document.documentElement.style.removeProperty('--grid-cols');
  });

  it('marks the root with the grid class and the column count, and follows remeasures', () => {
    let size = { width: 400, advance: 10 };
    const grid = createCharGrid({ root: document.documentElement, measure: () => size });
    const root = document.documentElement;
    expect(grid.cols.value).toBe(40);
    expect(root.getAttribute('data-grid')).toBe('full');
    expect(root.style.getPropertyValue('--grid-cols')).toBe('40');

    size = { width: 300, advance: 10 };
    grid.refresh();
    expect(grid.cols.value).toBeLessThan(DESIGN_COLS);
    expect(root.getAttribute('data-grid')).toBe('medium');

    size = { width: 300, advance: 20 };
    grid.refresh();
    expect(grid.cols.value).toBeLessThan(BOX_DRAWING_MIN_COLS);
    expect(root.getAttribute('data-grid')).toBe('narrow');

    grid.dispose();
    expect(root.hasAttribute('data-grid')).toBe(false);
  });

  it('keeps the design grid when nothing can be measured (jsdom, a hidden shell)', () => {
    const grid = createCharGrid({ root: document.documentElement, measure: () => ({ width: 0, advance: 0 }) });
    expect(document.documentElement.getAttribute('data-grid')).toBe('full');
    grid.dispose();
  });
});
