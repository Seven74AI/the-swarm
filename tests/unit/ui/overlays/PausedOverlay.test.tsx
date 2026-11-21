import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { createOverlayController } from '../../../../src/ui/shell/OverlayController';
import { OverlayHost } from '../../../../src/ui/shell/OverlayHost';
import { bindPausedOverlay, PAUSED_LINE } from '../../../../src/ui/overlays/PausedOverlay';

/**
 * Story 2.10 (FR25, UX-DR33 paused): while the game is paused the `PAUSED`
 * overlay line is up, and the next tap or key ends the pause. The tap or key
 * that resumes reaches nothing behind the overlay.
 */

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function setup() {
  const paused = signal(false);
  const overlays = createOverlayController(document.documentElement);
  const unpause = vi.fn(() => void (paused.value = false));
  const unbind = bindPausedOverlay({ paused, overlays, unpause });
  render(<OverlayHost overlays={overlays} />);
  const pause = () => act(() => void (paused.value = true));
  return { paused, overlays, unpause, unbind, pause };
}

describe('the PAUSED overlay', () => {
  it('shows the PAUSED line while paused, and only then', () => {
    const h = setup();
    expect(q('[data-overlay="paused"]')).toBeNull();
    h.pause();
    const overlay = q('[data-overlay="paused"]')!;
    expect(overlay).not.toBeNull();
    expect(q('[data-paused-line]')!.textContent).toBe(PAUSED_LINE);
    expect(overlay.contains(document.activeElement)).toBe(true);
    expect(document.documentElement.dataset.overlayActive).toBe('paused');
  });

  it('holds sheets while it is up (it is an overlay)', () => {
    const h = setup();
    h.pause();
    expect(h.overlays.held.value).toBe(true);
  });

  it('the next tap resumes', () => {
    const h = setup();
    h.pause();
    act(() => void fireEvent.pointerDown(q('[data-overlay="paused"]')!));
    expect(h.unpause).toHaveBeenCalledTimes(1);
    expect(q('[data-overlay="paused"]')).toBeNull();
    expect(h.overlays.held.value).toBe(false);
  });

  it('the next key resumes, and reaches nothing behind the overlay', () => {
    const h = setup();
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    h.pause();
    act(() => void fireEvent.keyDown(window, { key: 'p' }));
    expect(h.unpause).toHaveBeenCalledTimes(1);
    expect(behind).not.toHaveBeenCalled();
    expect(q('[data-overlay="paused"]')).toBeNull();
    document.removeEventListener('keydown', behind);
  });

  it('a held key repeating, or a lone modifier, does not resume', () => {
    const h = setup();
    h.pause();
    act(() => void fireEvent.keyDown(window, { key: 'p', repeat: true }));
    act(() => void fireEvent.keyDown(window, { key: 'Shift' }));
    expect(h.unpause).not.toHaveBeenCalled();
    expect(q('[data-overlay="paused"]')).not.toBeNull();
  });

  it('goes away when the pause ends elsewhere (hiding the page), without unpausing again', () => {
    const h = setup();
    h.pause();
    act(() => void (h.paused.value = false));
    expect(q('[data-overlay="paused"]')).toBeNull();
    expect(h.overlays.held.value).toBe(false);
    expect(h.unpause).not.toHaveBeenCalled();
  });

  it('pausing again shows it again; unbinding ends it', () => {
    const h = setup();
    h.pause();
    act(() => void fireEvent.pointerDown(q('[data-overlay="paused"]')!));
    h.pause();
    expect(q('[data-overlay="paused"]')).not.toBeNull();
    act(() => h.unbind());
    expect(q('[data-overlay="paused"]')).toBeNull();
  });
});
