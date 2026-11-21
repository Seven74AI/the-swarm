import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { NextActionButton } from '../../../../src/ui/shell/NextActionButton';
import { lockedTarget } from '../../../../src/ui/shell/targetLock';
import { nextActionBalance } from '../../../../src/data/balance/nextAction';
import type { NextAction } from '../../../../src/state/selectors';
import { OK } from '../../../../src/actions/result';

/**
 * Story 1.21 (UX-DR12): the primary action shows the next-action suggestion,
 * and its target never changes under the thumb: not while held, and not
 * within the lock window after the last tap.
 */

const LOCK = nextActionBalance.targetLockMs;

const gather: NextAction = {
  kind: 'act',
  rule: 'food',
  key: 'assignWorker:gather',
  verb: 'ASSIGN',
  target: 'GATHER',
  intent: { action: 'assignWorker', role: 'gather' },
  panel: 'worker_assignment',
};
const dig: NextAction = { ...gather, rule: 'capacity', key: 'assignWorker:dig', target: 'DIG', intent: { action: 'assignWorker', role: 'dig' } };
const goal: NextAction = { kind: 'act', rule: 'goal', key: 'continue', verb: 'CONTINUE', intent: { action: 'continuePhase' }, panel: 'phase_indicator' };

function shown(container: ParentNode): string | undefined {
  return (container.querySelector('[data-next-action]') as HTMLElement | null)?.dataset.nextKey;
}
function btn(container: ParentNode): HTMLButtonElement {
  const el = container.querySelector('button');
  if (!el) throw new Error('no button');
  return el;
}

describe('lockedTarget (Story 1.21)', () => {
  const free = { holding: false, lastTouchMs: null };
  it('follows the latest suggestion when untouched', () => {
    expect(lockedTarget(gather, dig, free, 0, LOCK)).toBe(dig);
    expect(lockedTarget(null, dig, free, 0, LOCK)).toBe(dig);
  });
  it('keeps the shown target while held, however long', () => {
    expect(lockedTarget(gather, dig, { holding: true, lastTouchMs: 0 }, LOCK * 10, LOCK)).toBe(gather);
  });
  it('keeps it inside the window after the last touch, and lets go after', () => {
    expect(lockedTarget(gather, dig, { holding: false, lastTouchMs: 100 }, 100 + LOCK - 1, LOCK)).toBe(gather);
    expect(lockedTarget(gather, dig, { holding: false, lastTouchMs: 100 }, 100 + LOCK, LOCK)).toBe(dig);
  });
  it('takes a fresh label for the same target at once', () => {
    const relabelled = { ...gather, verb: 'ASSIGN', target: 'GATHER ' };
    expect(lockedTarget(gather, relabelled, { holding: true, lastTouchMs: 0 }, 0, LOCK)).toBe(relabelled);
  });
});

describe('NextActionButton (Story 1.21)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the suggestion as the primary action and performs its intent on a tap', () => {
    const next = signal<NextAction>(gather);
    const perform = vi.fn(() => OK);
    const { container } = render(<NextActionButton next={next} perform={perform} />);
    const el = btn(container);
    expect(el.dataset.kind).toBe('primary');
    expect(el.textContent).toContain('ASSIGN');
    expect(el.textContent).toContain('GATHER');
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    expect(perform).toHaveBeenCalledWith(gather.kind === 'act' ? gather.intent : null);
  });

  it('follows a new suggestion when nobody is touching it', () => {
    const next = signal<NextAction>(gather);
    const { container } = render(<NextActionButton next={next} perform={() => OK} />);
    act(() => {
      next.value = dig;
    });
    expect(shown(container)).toBe('assignWorker:dig');
  });

  it('does not change the target while held, then waits out the lock window after release', () => {
    const next = signal<NextAction>(gather);
    const perform = vi.fn(() => OK);
    const { container } = render(<NextActionButton next={next} perform={perform} />);
    const el = btn(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    act(() => {
      next.value = dig;
    });
    act(() => {
      vi.advanceTimersByTime(LOCK * 3);
    });
    expect(shown(container)).toBe('assignWorker:gather');
    // Every repeat while held went to the target under the thumb.
    expect(perform.mock.calls.length).toBeGreaterThan(1);
    for (const call of perform.mock.calls as unknown as [unknown][]) expect(call[0]).toEqual({ action: 'assignWorker', role: 'gather' });

    fireEvent.pointerUp(btn(container), { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(LOCK - 1);
    });
    expect(shown(container)).toBe('assignWorker:gather');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(shown(container)).toBe('assignWorker:dig');
  });

  it('a tap holds the target for the lock window even if the suggestion changes right after', () => {
    const next = signal<NextAction>(gather);
    const { container } = render(<NextActionButton next={next} perform={() => OK} />);
    const el = btn(container);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    act(() => {
      next.value = dig;
    });
    expect(shown(container)).toBe('assignWorker:gather');
    act(() => {
      vi.advanceTimersByTime(LOCK);
    });
    expect(shown(container)).toBe('assignWorker:dig');
  });

  it('a keyboard activation also starts the lock window', () => {
    const next = signal<NextAction>(gather);
    const perform = vi.fn(() => OK);
    const { container } = render(<NextActionButton next={next} perform={perform} />);
    fireEvent.click(btn(container), { detail: 0 });
    expect(perform).toHaveBeenCalledTimes(1);
    act(() => {
      next.value = dig;
    });
    expect(shown(container)).toBe('assignWorker:gather');
    act(() => {
      vi.advanceTimersByTime(LOCK);
    });
    expect(shown(container)).toBe('assignWorker:dig');
  });

  it('CONTINUE does not repeat while held', () => {
    const next = signal<NextAction>(goal);
    const perform = vi.fn(() => OK);
    const { container } = render(<NextActionButton next={next} perform={perform} />);
    const el = btn(container);
    expect(el.textContent).toContain('CONTINUE');
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(LOCK * 3);
    });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('with no action, shows NEXT AFFORDABLE with the item and the time, and no button', () => {
    const next = signal<NextAction>({ kind: 'none', key: 'none:x:90', nextAffordable: { key: 'x', name: 'Warehouse', inSec: 90 } });
    const { container } = render(<NextActionButton next={next} perform={() => OK} />);
    expect(container.querySelector('button')).toBeNull();
    const line = container.querySelector('[data-next-action="none"]')!;
    expect(line.textContent).toMatch(/^NEXT AFFORDABLE: WAREHOUSE IN ~\S/);
  });

  it('with nothing reachable, shows no button and no NEXT AFFORDABLE line', () => {
    const next = signal<NextAction>({ kind: 'none', key: 'none', nextAffordable: null });
    const { container } = render(<NextActionButton next={next} perform={() => OK} />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).not.toContain('NEXT AFFORDABLE');
  });
});
