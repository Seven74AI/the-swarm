import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { Meter, meterCells } from '../../../../src/ui/primitives/Meter';

/** Story 1.12 (UX-DR29 accessibility floor): a meter is a progressbar; its typed cells are decoration. */
describe('Meter', () => {
  afterEach(() => cleanup());

  it('is a progressbar whose value text is supplied by the caller', () => {
    const { getByRole } = render(<Meter value={37} max={50} valueText="Workers 37 of 50" />);
    const bar = getByRole('progressbar');
    expect(bar.getAttribute('aria-valuetext')).toBe('Workers 37 of 50');
    expect(Number(bar.getAttribute('aria-valuenow'))).toBe(37);
    expect(Number(bar.getAttribute('aria-valuemin'))).toBe(0);
    expect(Number(bar.getAttribute('aria-valuemax'))).toBe(50);
  });

  it('hides its cells and percentage from assistive tech', () => {
    const { container } = render(<Meter value={3} max={4} valueText="3 of 4" />);
    const cells = container.querySelector('[data-meter-cells]');
    expect(cells).not.toBeNull();
    expect(cells!.closest('[aria-hidden="true"]')).not.toBeNull();
    const pct = container.querySelector('[data-meter-pct]');
    expect(pct!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('draws a fixed number of cells, never more filled than the value earns', () => {
    for (const [value, max] of [[0, 10], [1, 3], [5, 10], [10, 10], [99, 10], [-4, 10], [3, 0]]) {
      const { filled, empty } = meterCells(value, max, 14);
      expect(filled + empty).toBe(14);
      expect(Number.isInteger(filled)).toBe(true);
      expect(filled).toBeGreaterThanOrEqual(0);
      if (max > 0) expect(filled / 14).toBeLessThanOrEqual(Math.max(0, Math.min(1, value / max)));
    }
    expect(meterCells(10, 10, 14).filled).toBe(14);
    expect(meterCells(0, 10, 14).filled).toBe(0);
  });

  it('keeps aria values inside 0..max and integer', () => {
    const { getByRole } = render(<Meter value={77.8} max={50} valueText="over" />);
    const now = Number(getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(Number.isInteger(now)).toBe(true);
    expect(now).toBeLessThanOrEqual(50);
  });

  it('marks a warn meter so it can be drawn in warn', () => {
    const { getByRole } = render(<Meter value={80} max={100} valueText="Entropy 80 percent" warn />);
    expect(getByRole('progressbar').hasAttribute('data-warn')).toBe(true);
  });
});
