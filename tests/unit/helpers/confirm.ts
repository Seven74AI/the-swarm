import { signal } from '@preact/signals-core';
import { vi } from 'vitest';
import { fireEvent } from '@testing-library/preact';
import type { ConfirmSettings } from '../../../src/ui/primitives/HoldToConfirm';

/** The confirm settings main passes in (Story 1.10 defaults unless overridden). */
export function confirmSettings(over: Partial<ConfirmSettings> = {}) {
  return signal<ConfirmSettings>({ confirmStyle: 'hold', confirmHoldMs: 1000, ...over });
}

/**
 * Hold a HoldToConfirm control for `ms` with the pointer, then release it.
 * Needs `vi.useFakeTimers()`.
 */
export function holdFor(el: Element, ms: number, pointerId = 1): void {
  fireEvent.pointerDown(el, { pointerId, button: 0 });
  vi.advanceTimersByTime(ms);
  fireEvent.pointerUp(el, { pointerId, button: 0 });
}
