import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { createSheetController } from '../../../src/ui/shell/SheetController';
import { createOverlayController } from '../../../src/ui/shell/OverlayController';
import { App, type LegacyUi } from '../../../src/ui/App';
import type { ShellHosts } from '../../../src/ui/shell/hosts';
import { createTabShell } from '../../../src/ui/shell/tabShell';
import { Phase } from '../../../src/phases/phases';

/**
 * Story 1.7: the Preact root hosts the legacy `UIRoot`, so panels can migrate
 * one at a time while every existing selector keeps working. Since Story 1.15
 * it hosts it inside the tab shell.
 */
function fakeLegacy(): LegacyUi & { mount: ReturnType<typeof vi.fn> } {
  return {
    mount: vi.fn((hosts: ShellHosts) => {
      const bar = document.createElement('div');
      bar.id = 'top-bar';
      hosts.strip.appendChild(bar);
    }),
  };
}

const shell = () => createTabShell({ phase: signal(Phase.COLONY), affordable: signal('') });

describe('App (Preact root)', () => {
  afterEach(() => cleanup());

  it('mounts the legacy UI synchronously, inside the Preact root', () => {
    const legacy = fakeLegacy();
    const { container } = render(<App legacy={legacy} shell={shell()} />);

    // Boot reveals panels right after mounting, so the legacy DOM must exist when render() returns.
    expect(legacy.mount).toHaveBeenCalledTimes(1);
    const hosts = legacy.mount.mock.calls[0][0] as ShellHosts;
    expect(container.contains(hosts.root)).toBe(true);
    expect(container.querySelector('#top-bar')).not.toBeNull();
  });

  it('never remounts or wipes the legacy DOM when it re-renders', () => {
    const legacy = fakeLegacy();
    const s = shell();
    const { container, rerender } = render(<App legacy={legacy} shell={s} />);
    const bar = container.querySelector('#top-bar');

    rerender(<App legacy={legacy} shell={s} />);

    expect(legacy.mount).toHaveBeenCalledTimes(1);
    expect(container.querySelector('#top-bar')).toBe(bar);
  });

  it('draws the open sheet of the SheetController next to the legacy UI (Story 1.14)', () => {
    const sheets = createSheetController();
    const { container } = render(<App legacy={fakeLegacy()} shell={shell()} sheets={sheets} />);
    expect(container.querySelector('[data-probe]')).toBeNull();
    act(() => void sheets.open({ priority: 'modal', render: () => <p data-probe="" /> }));
    expect(container.querySelector('[data-probe]')).not.toBeNull();
    expect(container.querySelector('#top-bar')).not.toBeNull();
  });

  it('draws the overlay layer above the sheets, which wait while it is up (Story 1.20)', () => {
    const sheets = createSheetController();
    const overlays = createOverlayController();
    const { container } = render(<App legacy={fakeLegacy()} shell={shell()} sheets={sheets} overlays={overlays} />);
    let id = 0;
    act(() => {
      id = overlays.show({ kind: 'phase-reveal', render: () => <p data-overlay-probe="" /> });
    });
    act(() => void sheets.open({ priority: 'decision', render: () => <p data-probe="" /> }));
    expect(container.querySelector('[data-overlay-probe]')).not.toBeNull();
    expect(container.querySelector('[data-probe]')).toBeNull();
    act(() => overlays.end(id));
    expect(container.querySelector('[data-overlay-probe]')).toBeNull();
    expect(container.querySelector('[data-probe]')).not.toBeNull();
  });
});
