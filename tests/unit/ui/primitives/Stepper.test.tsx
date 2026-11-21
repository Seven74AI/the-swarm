import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import '@preact/signals';
import { Stepper, stepAmount, MULTIPLIERS, type Multiplier } from '../../../../src/ui/primitives/Stepper';
import { HOLD_DELAY_MS } from '../../../../src/ui/primitives/holdRepeat';

/**
 * Story 1.12 (FR45, UX-DR15): `[−] value [+]` with a ×1 ×10 ×MAX row.
 * Every step applies at once, stays within 0..available and repeats while held.
 */

const names = {
  addLabel: (n: number) => (n === 1 ? 'Add one gatherer' : `Add ${n} gatherers`),
  removeLabel: (n: number) => (n === 1 ? 'Remove one gatherer' : `Remove ${n} gatherers`),
};

/** A stepper whose value lives in local state, as a selector would feed it. */
function Harness(props: { start: number; available: number; onStep?: (d: number) => void; multiplier?: Multiplier }) {
  const [value, setValue] = useState(props.start);
  return (
    <Stepper
      value={value}
      available={props.available}
      onStep={(d) => {
        props.onStep?.(d);
        setValue((v) => v + d);
      }}
      {...names}
      initialMultiplier={props.multiplier}
      data-role="gatherer"
    />
  );
}

const valueOf = (c: ParentNode) => Number(c.querySelector('[data-stepper-value]')!.textContent);
const plus = (c: ParentNode) => c.querySelector<HTMLButtonElement>('[data-step="add"]')!;
const minus = (c: ParentNode) => c.querySelector<HTMLButtonElement>('[data-step="remove"]')!;
const tap = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
};

describe('stepAmount', () => {
  it('stays within 0 and available for every multiplier and direction', () => {
    for (const m of MULTIPLIERS) {
      for (const available of [0, 1, 7, 10, 25]) {
        for (let value = 0; value <= available; value++) {
          for (const dir of ['add', 'remove'] as const) {
            const d = stepAmount(dir, value, available, m);
            expect(Number.isInteger(d)).toBe(true);
            expect(value + d).toBeGreaterThanOrEqual(0);
            expect(value + d).toBeLessThanOrEqual(available);
            if (dir === 'add') expect(d).toBeGreaterThanOrEqual(0);
            else expect(d).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it('×1 moves one, ×10 moves up to ten, ×MAX goes all the way', () => {
    expect(stepAmount('add', 3, 50, 1)).toBe(1);
    expect(stepAmount('add', 3, 50, 10)).toBe(10);
    expect(stepAmount('add', 45, 50, 10)).toBe(5);
    expect(stepAmount('add', 3, 50, 'max')).toBe(47);
    expect(stepAmount('remove', 3, 50, 10)).toBe(-3);
    expect(stepAmount('remove', 30, 50, 'max')).toBe(-30);
  });
});

describe('Stepper primitive (Story 1.12)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('applies a tap immediately, with no confirm step', () => {
    const onStep = vi.fn();
    const { container } = render(<Harness start={2} available={10} onStep={onStep} />);
    tap(plus(container));
    expect(onStep).toHaveBeenCalledWith(1);
    expect(valueOf(container)).toBe(3);
    tap(minus(container));
    expect(valueOf(container)).toBe(2);
  });

  it('steps by the active multiplier and never leaves 0..available', () => {
    const { container, getByRole } = render(<Harness start={4} available={12} />);
    fireEvent.click(getByRole('button', { name: /×10/ }));
    tap(plus(container));
    expect(valueOf(container)).toBe(12);
    tap(plus(container));
    expect(valueOf(container)).toBe(12);
    tap(minus(container));
    expect(valueOf(container)).toBe(2);
    tap(minus(container));
    expect(valueOf(container)).toBe(0);
    fireEvent.click(getByRole('button', { name: /×MAX/ }));
    tap(plus(container));
    expect(valueOf(container)).toBe(12);
    tap(minus(container));
    expect(valueOf(container)).toBe(0);
  });

  it('shows the active multiplier as pressed, one at a time', () => {
    const { getByRole } = render(<Harness start={0} available={5} />);
    const pressed = () => MULTIPLIERS.filter((m) => getByRole('button', { name: m === 'max' ? /×MAX/ : new RegExp(`×${m}$`) }).getAttribute('aria-pressed') === 'true');
    expect(pressed()).toEqual([1]);
    fireEvent.click(getByRole('button', { name: /×MAX/ }));
    expect(pressed()).toEqual(['max']);
  });

  it('disables [+] at the limit and [−] at zero, and a press there does nothing', () => {
    const onStep = vi.fn();
    const { container } = render(<Harness start={0} available={0} onStep={onStep} />);
    expect(plus(container).getAttribute('aria-disabled')).toBe('true');
    expect(minus(container).getAttribute('aria-disabled')).toBe('true');
    tap(plus(container));
    tap(minus(container));
    expect(onStep).not.toHaveBeenCalled();
  });

  it('holding [+] repeats through the same step and stops at the limit', () => {
    const onStep = vi.fn();
    const { container } = render(<Harness start={0} available={6} onStep={onStep} />);
    fireEvent.pointerDown(plus(container), { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(HOLD_DELAY_MS + 3000);
    });
    fireEvent.pointerUp(plus(container), { pointerId: 1, button: 0 });
    expect(valueOf(container)).toBe(6);
    expect(onStep.mock.calls.length).toBeGreaterThan(1);
    expect(onStep.mock.calls.every(([d]) => d === 1)).toBe(true);
  });

  it('gives each bracket the accessible name the caller supplies, for the active step', () => {
    const { getByRole } = render(<Harness start={5} available={50} />);
    expect(getByRole('button', { name: 'Add one gatherer' })).toBeTruthy();
    expect(getByRole('button', { name: 'Remove one gatherer' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: /×10/ }));
    expect(getByRole('button', { name: 'Add 10 gatherers' })).toBeTruthy();
    expect(getByRole('button', { name: 'Remove 5 gatherers' })).toBeTruthy();
  });

  it('accepts a plain string name too', () => {
    const { getByRole } = render(
      <Stepper value={1} available={3} onStep={() => {}} addLabel="Add one guard" removeLabel="Remove one guard" />,
    );
    expect(getByRole('button', { name: 'Add one guard' })).toBeTruthy();
  });

  it('can share a multiplier row owned by the caller', () => {
    const onStep = vi.fn();
    const { container, queryByRole } = render(
      <Stepper value={0} available={40} onStep={onStep} multiplier={10} {...names} />,
    );
    expect(queryByRole('button', { name: /×MAX/ })).toBeNull();
    tap(plus(container));
    expect(onStep).toHaveBeenCalledWith(10);
  });
});
