import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { bindDebugToggle, LONG_PRESS_MS } from '../../../src/debug/toggle';

/** Story 1.34 (AR24): the backtick key or a 3-finger long-press toggles the overlay. */

function touch(type: string, fingers: number): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: { length: fingers } });
  return e;
}

describe('debug toggle', () => {
  let toggle: Mock<() => void>;
  let unbind: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    toggle = vi.fn<() => void>();
    unbind = bindDebugToggle(window, toggle);
  });

  afterEach(() => {
    unbind();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('toggles on the backtick key', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`', bubbles: true }));
    expect(toggle).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`', bubbles: true }));
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys, held repeats, modified keys and typing in a field', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`', repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`', ctrlKey: true }));
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '`', bubbles: true }));
    expect(toggle).not.toHaveBeenCalled();
  });

  it('toggles after a 3-finger long-press', () => {
    window.dispatchEvent(touch('touchstart', 3));
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(toggle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('does not toggle for fewer fingers, or when the fingers lift early', () => {
    window.dispatchEvent(touch('touchstart', 2));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    window.dispatchEvent(touch('touchstart', 3));
    vi.advanceTimersByTime(LONG_PRESS_MS / 2);
    window.dispatchEvent(touch('touchend', 2));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('stops listening once unbound', () => {
    unbind();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }));
    window.dispatchEvent(touch('touchstart', 3));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(toggle).not.toHaveBeenCalled();
  });
});
