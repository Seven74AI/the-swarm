import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import '@preact/signals';
import { Button } from '../../../../src/ui/primitives/Button';
import {
  HOLD_DELAY_MS,
  REPEAT_INTERVAL_MS,
  FAST_REPEAT_INTERVAL_MS,
  ACCELERATE_AFTER_MS,
  repeatDelay,
} from '../../../../src/ui/primitives/holdRepeat';
import { OK, refuse, type ActionResult } from '../../../../src/actions/result';
import { spoken } from '../../helpers/a11y';

/**
 * Story 1.11 (FR45, UX-DR11, UX-DR20, UX-DR38, NFR1): the Button primitive.
 * Pressed on pointer-down, fires on pointer-up, repeats while held.
 */

function button(container: ParentNode): HTMLButtonElement {
  const el = container.querySelector('button');
  if (!el) throw new Error('no button');
  return el;
}

describe('hold-repeat schedule', () => {
  it('repeats at about 8 per second, then faster after 1 s', () => {
    const perSecond = 1000 / REPEAT_INTERVAL_MS;
    expect(perSecond).toBeGreaterThanOrEqual(6);
    expect(perSecond).toBeLessThanOrEqual(10);
    expect(FAST_REPEAT_INTERVAL_MS).toBeLessThan(REPEAT_INTERVAL_MS);
    expect(repeatDelay(0)).toBe(REPEAT_INTERVAL_MS);
    expect(repeatDelay(ACCELERATE_AFTER_MS - 1)).toBe(REPEAT_INTERVAL_MS);
    expect(repeatDelay(ACCELERATE_AFTER_MS)).toBe(FAST_REPEAT_INTERVAL_MS);
    // A tap must be able to finish before the first repeat.
    expect(HOLD_DELAY_MS).toBeGreaterThan(REPEAT_INTERVAL_MS);
    expect(HOLD_DELAY_MS).toBeLessThan(ACCELERATE_AFTER_MS);
  });
});

describe('Button primitive (Story 1.11)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the pressed state on pointer-down, synchronously and before the action runs', () => {
    const onPress = vi.fn(() => OK);
    const { container } = render(<Button variant="primary" verb="LAY" target="EGG" onPress={onPress} />);
    const el = button(container);
    expect(el.dataset.pressed).not.toBe('true');

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });

    // No await: the inverse state is on the element in the same task as the event.
    expect(el.dataset.pressed).toBe('true');
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires once on pointer-up over the button and releases the pressed state', () => {
    const onPress = vi.fn(() => OK);
    const { container } = render(<Button verb="LAY" target="EGG" onPress={onPress} />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    // The browser follows up with a click; it must not fire a second time.
    fireEvent.click(el, { detail: 1 });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(el.dataset.pressed).not.toBe('true');
  });

  it('dragging off cancels the action', () => {
    const onPress = vi.fn(() => OK);
    const { container } = render(<Button verb="LAY" target="EGG" onPress={onPress} />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerLeave(el, { pointerId: 1 });
    expect(el.dataset.pressed).not.toBe('true');
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('a pointer-cancel (the page starts scrolling) cancels the action', () => {
    const onPress = vi.fn(() => OK);
    const { container } = render(<Button verb="LAY" target="EGG" onPress={onPress} repeat />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerCancel(el, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onPress).not.toHaveBeenCalled();
    expect(el.dataset.pressed).not.toBe('true');
  });

  it('a held repeatable action repeats, speeds up after 1 s, and stays inverse without re-inverting', () => {
    const onPress = vi.fn(() => OK);
    const { container } = render(<Button variant="primary" verb="BUY" target="WORKER" onPress={onPress} repeat />);
    const el = button(container);
    const pressedChanges: Array<string | null> = [];
    const observer = new MutationObserver(() => pressedChanges.push(el.getAttribute('data-pressed')));
    observer.observe(el, { attributes: true, attributeFilter: ['data-pressed'] });

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(ACCELERATE_AFTER_MS);
    });
    const firstSecond = onPress.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const secondSecond = onPress.mock.calls.length - firstSecond;

    expect(firstSecond).toBeGreaterThan(1);
    expect(secondSecond).toBeGreaterThan(firstSecond);
    expect(el.dataset.pressed).toBe('true');

    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    observer.disconnect();

    // Releasing after repeats adds no extra fire.
    expect(onPress.mock.calls.length).toBe(firstSecond + secondSecond);
    // Inverted once on press, restored once on release: never per repeat.
    return Promise.resolve().then(() => {
      expect(pressedChanges.length).toBeLessThanOrEqual(2);
    });
  });

  it('stops repeating at the first refusal', () => {
    let left = 3;
    const onPress = vi.fn((): ActionResult => (left-- > 0 ? OK : refuse('cannot_afford')));
    const { container } = render(<Button verb="BUY" target="WORKER" onPress={onPress} repeat />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });

    // Three accepted, then the refusing call, then nothing.
    expect(onPress).toHaveBeenCalledTimes(4);
  });

  it('a non-repeatable button does not repeat while held, and fires once on release', () => {
    const onPress = vi.fn(() => OK);
    const { container } = render(<Button verb="START" target="RESEARCH" onPress={onPress} />);
    const el = button(container);

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a keyboard activation fires once', () => {
    const onPress = vi.fn(() => OK);
    const { container } = render(<Button verb="LAY" target="EGG" onPress={onPress} />);
    fireEvent.click(button(container), { detail: 0 });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a disabled button stays focusable, never fires or inverts, and shows its reason on the cost line', () => {
    const onPress = vi.fn(() => OK);
    const { container, getByText } = render(
      <Button verb="BUY" target="WORKER" onPress={onPress} disabled="needs 10 more food" repeat />,
    );
    const el = button(container);

    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.disabled).toBe(false);
    expect(el.dataset.variant).toBe('disabled');

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    expect(el.dataset.pressed).not.toBe('true');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    fireEvent.click(el, { detail: 0 });
    expect(onPress).not.toHaveBeenCalled();

    const reason = getByText('needs 10 more food');
    expect(reason.closest('[data-cost]')).not.toBeNull();
    // The reason is announced with the button.
    expect(el.getAttribute('aria-describedby')).toContain(reason.closest('[data-cost]')!.id);
  });

  it('a primary action shows "> " and a block cursor, both hidden from assistive tech', () => {
    const { container } = render(<Button variant="primary" verb="LAY" target="EGG" onPress={() => OK} />);
    const el = button(container);
    const prefix = el.querySelector('[data-prefix]');
    const cursor = el.querySelector('[data-cursor]');

    expect(prefix?.textContent).toBe('> ');
    expect(cursor?.textContent).toBe('█');
    expect(prefix?.getAttribute('aria-hidden')).toBe('true');
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');
    // Accessible name is the verb and its target only, never the prompt glyphs.
    expect(spoken(el)).toBe('LAY EGG');
  });

  it('a secondary action has neither prefix nor cursor', () => {
    const { container } = render(<Button variant="secondary" verb="SKIP" onPress={() => OK} />);
    const el = button(container);
    expect(el.querySelector('[data-prefix]')).toBeNull();
    expect(el.querySelector('[data-cursor]')).toBeNull();
    expect(el.dataset.variant).toBe('secondary');
  });

  it('keeps the verb and the target in separate boxes so only the target truncates', () => {
    const { container } = render(
      <Button variant="primary" verb="ASSIGN" target="A VERY LONG ROLE NAME THAT WILL NOT FIT" onPress={() => OK} />,
    );
    const el = button(container);
    expect(el.querySelector('[data-verb]')?.textContent).toBe('ASSIGN');
    expect(el.querySelector('[data-target]')?.textContent).toBe('A VERY LONG ROLE NAME THAT WILL NOT FIT');
  });

  it('holds the cursor steady while pressed and restarts its blink after release', () => {
    const { container } = render(<Button variant="primary" verb="LAY" target="EGG" onPress={() => OK} />);
    const el = button(container);
    const before = el.querySelector('[data-cursor]');
    expect(before?.getAttribute('data-blink')).toBe('true');

    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    expect(el.dataset.pressed).toBe('true');
    expect(el.querySelector('[data-cursor]')?.getAttribute('data-blink')).toBe('false');

    act(() => {
      fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
    });
    const after = el.querySelector('[data-cursor]');
    expect(after?.getAttribute('data-blink')).toBe('true');
    // A fresh element restarts the 5 s CSS blink.
    expect(after).not.toBe(before);
  });

  it('passes data-* hooks through to the button', () => {
    const { container } = render(<Button verb="LAY" target="EGG" onPress={() => OK} data-action="lay-egg" />);
    expect(button(container).dataset.action).toBe('lay-egg');
  });
});

describe('Button accessible name (Story 1.12)', () => {
  afterEach(() => cleanup());

  it('uses a caller-supplied label as its name, in place of the typed text', () => {
    const { getByRole } = render(<Button verb="[+]" label="Add one gatherer" onPress={() => {}} />);
    expect(getByRole('button', { name: 'Add one gatherer' })).toBeTruthy();
  });
});
