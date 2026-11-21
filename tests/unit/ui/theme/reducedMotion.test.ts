import { describe, it, expect } from 'vitest';
import { signal } from '@preact/signals-core';
import { bindReducedMotion } from '../../../../src/ui/theme/reducedMotion';

/**
 * Story 1.11: the reduced-motion setting in effect (Story 1.10, passed in by
 * main) is one attribute on the root, so CSS (the Button cursor) can hold
 * still without importing platform/.
 */
describe('bindReducedMotion', () => {
  it('mirrors the reduced-motion signal onto data-reduced-motion and follows changes', () => {
    const root = document.createElement('div');
    const reduced = signal(false);
    const dispose = bindReducedMotion(root, reduced);
    expect(root.dataset.reducedMotion).toBe('false');

    reduced.value = true;
    expect(root.dataset.reducedMotion).toBe('true');

    dispose();
    reduced.value = false;
    expect(root.dataset.reducedMotion).toBe('true');
  });
});
