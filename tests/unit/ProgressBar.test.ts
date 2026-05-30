import { describe, it, expect } from 'vitest';
import { ProgressBar } from '../../src/ui/components/ProgressBar';

describe('ProgressBar — capacity color states', () => {
  it('shows percentage text', () => {
    const bar = new ProgressBar('Test');
    bar.update(3, 10);
    const el = bar.getElement();
    const percentEl = el.querySelector('.progress-percent');
    expect(percentEl?.textContent).toBe('30%');
  });

  it('applies capacity-warning class when passed', () => {
    const bar = new ProgressBar('Nest Capacity');
    bar.update(23, 25, 'capacity-warning');
    const el = bar.getElement();
    const fill = el.querySelector('.progress-fill')!;
    expect(fill.classList.contains('capacity-warning')).toBe(true);
    expect(fill.classList.contains('capacity-full')).toBe(false);
  });

  it('applies capacity-full class when passed', () => {
    const bar = new ProgressBar('Nest Capacity');
    bar.update(25, 25, 'capacity-full');
    const el = bar.getElement();
    const fill = el.querySelector('.progress-fill')!;
    expect(fill.classList.contains('capacity-full')).toBe(true);
    expect(fill.classList.contains('capacity-warning')).toBe(false);
  });

  it('removes previous color class when switching', () => {
    const bar = new ProgressBar('Nest Capacity');

    // First set to warning
    bar.update(23, 25, 'capacity-warning');
    const el = bar.getElement();
    const fill = el.querySelector('.progress-fill')!;
    expect(fill.classList.contains('capacity-warning')).toBe(true);

    // Then set to full — warning should be removed
    bar.update(25, 25, 'capacity-full');
    expect(fill.classList.contains('capacity-warning')).toBe(false);
    expect(fill.classList.contains('capacity-full')).toBe(true);
  });

  it('removes color classes when no colorClass is passed', () => {
    const bar = new ProgressBar('Nest Capacity');

    // Set to full first
    bar.update(25, 25, 'capacity-full');
    const el = bar.getElement();
    const fill = el.querySelector('.progress-fill')!;
    expect(fill.classList.contains('capacity-full')).toBe(true);

    // Update without color class — both should be removed
    bar.update(20, 25);
    expect(fill.classList.contains('capacity-warning')).toBe(false);
    expect(fill.classList.contains('capacity-full')).toBe(false);
  });

  it('clamps percentage to 100 when current exceeds max', () => {
    const bar = new ProgressBar('Nest Capacity');
    bar.update(30, 25, 'capacity-full');
    const el = bar.getElement();
    const percentEl = el.querySelector('.progress-percent');
    expect(percentEl?.textContent).toBe('100%');
  });

  it('shows 0% when max is 0', () => {
    const bar = new ProgressBar('Nest Capacity');
    bar.update(5, 0);
    const el = bar.getElement();
    const percentEl = el.querySelector('.progress-percent');
    expect(percentEl?.textContent).toBe('0%');
  });

  it('shows label in progress-header', () => {
    const bar = new ProgressBar('Nest Capacity');
    const el = bar.getElement();
    const label = el.querySelector('.progress-label');
    expect(label?.textContent).toBe('Nest Capacity');
  });
});
