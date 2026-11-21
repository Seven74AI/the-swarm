import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { App, type LegacyUi } from '../../../src/ui/App';

/**
 * Story 1.7: the Preact root hosts the legacy `UIRoot` unchanged, so panels
 * can migrate one at a time while every existing selector keeps working.
 */
function fakeLegacy(): LegacyUi & { mount: ReturnType<typeof vi.fn> } {
  return {
    mount: vi.fn((container: HTMLElement) => {
      container.innerHTML = '';
      const bar = document.createElement('div');
      bar.id = 'top-bar';
      container.appendChild(bar);
    }),
  };
}

describe('App (Preact root)', () => {
  afterEach(() => cleanup());

  it('mounts the legacy UI synchronously, inside the Preact root', () => {
    const legacy = fakeLegacy();
    const { container } = render(<App legacy={legacy} />);

    // Boot reveals panels right after mounting, so the legacy DOM must exist when render() returns.
    expect(legacy.mount).toHaveBeenCalledTimes(1);
    const host = legacy.mount.mock.calls[0][0] as HTMLElement;
    expect(container.contains(host)).toBe(true);
    expect(container.querySelector('#top-bar')).not.toBeNull();
  });

  it('keeps the legacy layout: the host box does not take part in layout', () => {
    const legacy = fakeLegacy();
    render(<App legacy={legacy} />);
    const host = legacy.mount.mock.calls[0][0] as HTMLElement;

    // The legacy panels are styled as direct flex children of #app.
    expect(host.style.display).toBe('contents');
  });

  it('never remounts or wipes the legacy DOM when it re-renders', () => {
    const legacy = fakeLegacy();
    const { container, rerender } = render(<App legacy={legacy} />);
    const bar = container.querySelector('#top-bar');

    rerender(<App legacy={legacy} />);

    expect(legacy.mount).toHaveBeenCalledTimes(1);
    expect(container.querySelector('#top-bar')).toBe(bar);
  });
});
