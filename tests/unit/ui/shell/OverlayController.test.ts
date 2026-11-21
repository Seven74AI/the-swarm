import { describe, it, expect, vi } from 'vitest';
import { createOverlayController } from '../../../../src/ui/shell/OverlayController';

/**
 * Story 1.20 (AR10, D7): one overlay layer. At most one overlay plays at a time;
 * while one is up, `held` is true (sheets and decision events wait), and the
 * root carries `data-overlay-active=<kind>` from the moment it is requested, so CSS
 * keyed to it applies in the same style pass as the phase change.
 */
describe('OverlayController', () => {
  it('shows one overlay at a time and holds while it is up', () => {
    const root = document.createElement('div');
    const overlays = createOverlayController(root);
    expect(overlays.held.value).toBe(false);
    expect(root.hasAttribute('data-overlay-active')).toBe(false);

    const id = overlays.show({ kind: 'phase-reveal', render: () => null });
    expect(overlays.active.value?.id).toBe(id);
    expect(overlays.held.value).toBe(true);
    expect(root.dataset.overlayActive).toBe('phase-reveal');

    overlays.end(id);
    expect(overlays.active.value).toBeNull();
    expect(overlays.held.value).toBe(false);
    expect(root.hasAttribute('data-overlay-active')).toBe(false);
  });

  it('queues a second overlay until the first ends', () => {
    const overlays = createOverlayController();
    const a = overlays.show({ kind: 'phase-reveal', render: () => null });
    const b = overlays.show({ kind: 'phase-reveal', render: () => null });
    expect(overlays.active.value?.id).toBe(a);
    overlays.end(a);
    expect(overlays.active.value?.id).toBe(b);
    expect(overlays.held.value).toBe(true);
    overlays.end(b);
    expect(overlays.held.value).toBe(false);
  });

  it('runs onEnd once, and ignores unknown or repeated ends', () => {
    const overlays = createOverlayController();
    const onEnd = vi.fn();
    const id = overlays.show({ kind: 'phase-reveal', render: () => null, onEnd });
    overlays.end(id);
    overlays.end(id);
    overlays.end(999);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('drops a waiting overlay that ends before it plays', () => {
    const overlays = createOverlayController();
    const onEnd = vi.fn();
    const a = overlays.show({ kind: 'phase-reveal', render: () => null });
    const b = overlays.show({ kind: 'phase-reveal', render: () => null, onEnd });
    overlays.end(b);
    expect(onEnd).toHaveBeenCalledTimes(1);
    overlays.end(a);
    expect(overlays.active.value).toBeNull();
  });
});
