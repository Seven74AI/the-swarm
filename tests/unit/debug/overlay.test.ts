import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { mountDebugOverlay, type DebugOverlayHandle } from '../../../src/debug/overlay';
import { createTickTimings } from '../../../src/debug/timings';
import { makeState } from '../helpers/makeState';

/** Story 1.34: the overlay mounts closed, and the backtick key opens and closes it. */

let handle: DebugOverlayHandle | null = null;
afterEach(() => {
  handle?.unmount();
  handle = null;
});

describe('mountDebugOverlay', () => {
  it('starts closed and toggles with the backtick key', () => {
    const onExport = vi.fn();
    handle = mountDebugOverlay({
      state: signal(makeState()),
      ticks: createTickTimings(),
      catchUpMs: null,
      saveVersion: 19,
      build: 'dev',
      onExportDiagnostics: onExport,
    });
    expect(document.querySelector('[data-debug-root][data-ready]')).not.toBeNull();
    expect(document.querySelector('[data-debug-overlay]')).toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }));
    expect(handle.isOpen()).toBe(true);
    expect(document.querySelector('[data-debug-overlay]')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }));
    expect(document.querySelector('[data-debug-overlay]')).toBeNull();
  });

  it('leaves nothing behind when unmounted', () => {
    handle = mountDebugOverlay({
      state: signal(makeState()),
      ticks: createTickTimings(),
      catchUpMs: 3,
      saveVersion: 19,
      build: 'dev',
      onExportDiagnostics: () => {},
    });
    handle.unmount();
    handle = null;
    expect(document.querySelector('[data-debug-root]')).toBeNull();
  });
});
