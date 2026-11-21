import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import { ToastHost, createToasts, TOAST_MS } from '../../../../src/ui/primitives/Toast';

/** Story 1.12 (UX-DR29): one line for 2 s, replacing any earlier toast. */
describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows one line, then disappears after its duration', () => {
    const toasts = createToasts();
    const { container } = render(<ToastHost toasts={toasts} />);
    act(() => toasts.show('THE BEETLES TOOK 3 FORAGERS.'));
    expect(container.querySelectorAll('[data-toast]')).toHaveLength(1);
    expect(container.textContent).toContain('THE BEETLES TOOK 3 FORAGERS.');
    act(() => {
      vi.advanceTimersByTime(TOAST_MS - 1);
    });
    expect(container.querySelectorAll('[data-toast]')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelectorAll('[data-toast]')).toHaveLength(0);
  });

  it('lasts 2 s', () => {
    expect(TOAST_MS).toBe(2000);
  });

  it('replaces an earlier toast, and the new one gets its full time', () => {
    const toasts = createToasts();
    const { container } = render(<ToastHost toasts={toasts} />);
    act(() => toasts.show('first'));
    act(() => {
      vi.advanceTimersByTime(TOAST_MS - 100);
    });
    act(() => toasts.show('second'));
    const shown = container.querySelectorAll('[data-toast]');
    expect(shown).toHaveLength(1);
    expect(shown[0].textContent).toBe('second');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('[data-toast]')?.textContent).toBe('second');
    act(() => {
      vi.advanceTimersByTime(TOAST_MS);
    });
    expect(container.querySelector('[data-toast]')).toBeNull();
  });

  it('keeps a toast to one line', () => {
    const toasts = createToasts();
    const { container } = render(<ToastHost toasts={toasts} />);
    act(() => toasts.show('line one\nline two'));
    expect(container.querySelector('[data-toast]')?.textContent).not.toContain('\n');
  });

  it('is announced politely', () => {
    const toasts = createToasts();
    const { container } = render(<ToastHost toasts={toasts} />);
    act(() => toasts.show('saved'));
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live!.textContent).toContain('saved');
  });
});
