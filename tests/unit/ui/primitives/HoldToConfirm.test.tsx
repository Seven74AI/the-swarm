import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { HoldToConfirm, type ConfirmSettings } from '../../../../src/ui/primitives/HoldToConfirm';
import { ARM_MS, RING_CELLS, RING_ORDER, cellsFilled } from '../../../../src/ui/primitives/holdConfirm';
import { OK } from '../../../../src/actions/result';

/**
 * Story 1.13 (UX-DR21): irreversible actions need a hold or two taps.
 * Hold mode: a square ring of block cells fills clockwise; the action fires
 * only when it completes. Two-tap mode: the first tap arms for ARM_MS.
 */

const HOLD_MS = 1000;

function settings(over: Partial<ConfirmSettings> = {}) {
  return signal<ConfirmSettings>({ confirmStyle: 'hold', confirmHoldMs: HOLD_MS, ...over });
}

function button(container: ParentNode): HTMLButtonElement {
  const el = container.querySelector('button');
  if (!el) throw new Error('no button');
  return el;
}

function filledCells(el: HTMLElement): number {
  return el.querySelectorAll('[data-ring-cell][data-filled="true"]').length;
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('hold ring geometry', () => {
  it('is a closed square ring of block cells, walked clockwise', () => {
    expect(RING_ORDER).toHaveLength(RING_CELLS);
    const key = (c: { row: number; col: number }) => `${c.row},${c.col}`;
    expect(new Set(RING_ORDER.map(key)).size).toBe(RING_CELLS);
    // Each cell touches the next along an edge, the last touches the first: a closed ring.
    for (let i = 0; i < RING_ORDER.length; i++) {
      const a = RING_ORDER[i];
      const b = RING_ORDER[(i + 1) % RING_ORDER.length];
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
    // Shoelace sum in screen coordinates (row grows downward): positive means clockwise.
    let area = 0;
    for (let i = 0; i < RING_ORDER.length; i++) {
      const a = RING_ORDER[i];
      const b = RING_ORDER[(i + 1) % RING_ORDER.length];
      area += a.col * b.row - b.col * a.row;
    }
    expect(area).toBeGreaterThan(0);
  });

  it('fills whole cells with the hold, from none to all', () => {
    expect(cellsFilled(0, HOLD_MS)).toBe(0);
    expect(cellsFilled(HOLD_MS, HOLD_MS)).toBe(RING_CELLS);
    expect(cellsFilled(HOLD_MS * 2, HOLD_MS)).toBe(RING_CELLS);
    let prev = 0;
    for (let t = 0; t <= HOLD_MS; t += 37) {
      const n = cellsFilled(t, HOLD_MS);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    // Not complete a moment before the hold ends.
    expect(cellsFilled(HOLD_MS - 1, HOLD_MS)).toBeLessThan(RING_CELLS);
  });
});

describe('HoldToConfirm, hold mode (Story 1.13)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('fires only when the ring completes, exactly once', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    expect(el.dataset.pressed).toBe('true');
    await advance(HOLD_MS / 2);
    expect(onConfirm).not.toHaveBeenCalled();
    const half = filledCells(el);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(RING_CELLS);

    await advance(HOLD_MS / 2 - 1);
    expect(onConfirm).not.toHaveBeenCalled();
    await advance(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Still holding: nothing more fires, and releasing doesn't fire again.
    await advance(HOLD_MS * 3);
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    await advance(HOLD_MS);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('releasing early drains the ring and does nothing', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    await advance(HOLD_MS * 0.75);
    const before = filledCells(el);
    expect(before).toBeGreaterThan(0);
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    expect(el.dataset.pressed).not.toBe('true');

    await advance(HOLD_MS / 8);
    expect(filledCells(el)).toBeLessThan(before);
    await advance(HOLD_MS * 2);
    expect(filledCells(el)).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('dragging off or a pointer-cancel aborts the hold', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    await advance(HOLD_MS / 2);
    fireEvent.pointerLeave(el, { pointerId: 1 });
    await advance(HOLD_MS * 2);

    fireEvent.pointerDown(el, { pointerId: 2, button: 0 });
    await advance(HOLD_MS / 2);
    fireEvent.pointerCancel(el, { pointerId: 2 });
    await advance(HOLD_MS * 2);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a click (tap or keyboard activation) never fires in hold mode', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} />);
    const el = button(container);

    el.click();
    fireEvent.click(el, { detail: 1 });
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    await advance(HOLD_MS * 2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('follows the hold duration from settings', async () => {
    const onConfirm = vi.fn(() => OK);
    const s = settings({ confirmHoldMs: HOLD_MS * 2 });
    const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={s} />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    await advance(HOLD_MS * 2 - 1);
    expect(onConfirm).not.toHaveBeenCalled();
    await advance(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });

    // A shorter setting takes effect on the next hold.
    act(() => {
      s.value = { ...s.value, confirmHoldMs: HOLD_MS / 2 };
    });
    fireEvent.pointerDown(el, { pointerId: 3, button: 0 });
    await advance(HOLD_MS / 2);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  for (const key of ['Enter', ' ']) {
    const name = key === ' ' ? 'Space' : key;
    it(`holding ${name} on the focused control behaves the same way`, async () => {
      const onConfirm = vi.fn(() => OK);
      const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} />);
      const el = button(container);
      el.focus();

      // Early release: nothing.
      fireEvent.keyDown(el, { key });
      await advance(HOLD_MS / 2);
      fireEvent.keyUp(el, { key });
      await advance(HOLD_MS * 2);
      expect(onConfirm).not.toHaveBeenCalled();

      // Full hold, with key auto-repeat along the way: fires once.
      fireEvent.keyDown(el, { key });
      await advance(HOLD_MS / 2);
      fireEvent.keyDown(el, { key, repeat: true });
      await advance(HOLD_MS / 2);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      fireEvent.keyUp(el, { key });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  }

  it('keeps Enter and Space to itself, so page shortcuts (Space pauses) do not fire', () => {
    const onDoc = vi.fn();
    document.addEventListener('keydown', onDoc);
    try {
      const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={() => OK} settings={settings()} />);
      const el = button(container);
      fireEvent.keyDown(el, { key: ' ' });
      fireEvent.keyDown(el, { key: 'Enter' });
      expect(onDoc).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', onDoc);
    }
  });

  it('losing focus mid-hold aborts it', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} />);
    const el = button(container);
    el.focus();
    fireEvent.keyDown(el, { key: 'Enter' });
    await advance(HOLD_MS / 2);
    fireEvent.blur(el);
    await advance(HOLD_MS * 2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disabled: never fires, stays focusable and shows its reason', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(
      <HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} disabled="requirements not met" />,
    );
    const el = button(container);
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.disabled).toBe(false);
    expect(el.textContent).toContain('requirements not met');
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.keyDown(el, { key: 'Enter' });
    await advance(HOLD_MS * 2);
    expect(filledCells(el)).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('passes class, title and data-* hooks onto the button', () => {
    const { container } = render(
      <HoldToConfirm
        verb="TRANSCEND"
        onConfirm={() => OK}
        settings={settings()}
        class="btn-prestige prestige-ready"
        title="why"
        data-action="prestige"
      />,
    );
    const el = button(container);
    expect(el.classList.contains('btn-prestige')).toBe(true);
    expect(el.classList.contains('prestige-ready')).toBe(true);
    expect(el.getAttribute('title')).toBe('why');
    expect(el.dataset.action).toBe('prestige');
  });

  it('stops its timers when unmounted mid-hold', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container, unmount } = render(<HoldToConfirm verb="TRANSCEND" onConfirm={onConfirm} settings={settings()} />);
    fireEvent.pointerDown(button(container), { pointerId: 1, button: 0 });
    await advance(HOLD_MS / 2);
    unmount();
    await advance(HOLD_MS * 2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('HoldToConfirm, two-tap mode (Story 1.13)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const twoTaps = () => settings({ confirmStyle: 'twoTaps' });

  it('the first tap arms with "> TAP AGAIN TO <VERB>" in inverse video; the second fires', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="Cancel" target="research" onConfirm={onConfirm} settings={twoTaps()} />);
    const el = button(container);
    expect(el.textContent).not.toContain('TAP AGAIN');
    expect(el.querySelector('[data-ring]')).toBeNull();

    fireEvent.click(el, { detail: 1 });
    await advance(0);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(el.dataset.armed).toBe('true');
    expect(el.textContent).toContain('> TAP AGAIN TO CANCEL');

    await advance(ARM_MS - 1);
    fireEvent.click(el, { detail: 1 });
    await advance(0);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(el.dataset.armed).not.toBe('true');
    expect(el.textContent).not.toContain('TAP AGAIN');
  });

  it('disarms after ARM_MS without a second tap', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="Cancel" onConfirm={onConfirm} settings={twoTaps()} />);
    const el = button(container);

    fireEvent.click(el, { detail: 1 });
    await advance(ARM_MS);
    expect(el.dataset.armed).not.toBe('true');
    expect(el.textContent).not.toContain('TAP AGAIN');

    // A tap after the window only arms again.
    fireEvent.click(el, { detail: 1 });
    await advance(0);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(el.dataset.armed).toBe('true');
  });

  it('keyboard activation counts as a tap', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(<HoldToConfirm verb="Cancel" onConfirm={onConfirm} settings={twoTaps()} />);
    const el = button(container);
    el.click();
    await advance(0);
    el.click();
    await advance(0);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disabled: taps never arm or fire', async () => {
    const onConfirm = vi.fn(() => OK);
    const { container } = render(
      <HoldToConfirm verb="Cancel" onConfirm={onConfirm} settings={twoTaps()} disabled="not now" />,
    );
    const el = button(container);
    fireEvent.click(el, { detail: 1 });
    fireEvent.click(el, { detail: 1 });
    await advance(0);
    expect(el.dataset.armed).not.toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
