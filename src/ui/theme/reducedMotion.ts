/**
 * Reduced-motion binding (Story 1.11).
 *
 * main passes in the setting in effect (Story 1.10: the player's choice, or
 * the OS's when it is `os`); this keeps one attribute on the root in step, so
 * CSS can drop motion (the Button cursor holds steady) without ui/ importing
 * platform/. Returns a disposer.
 */
import { effect, type ReadonlySignal } from '@preact/signals-core';

export function bindReducedMotion(root: HTMLElement, reducedMotion: ReadonlySignal<boolean>): () => void {
  return effect(() => {
    const value = String(reducedMotion.value);
    if (root.dataset.reducedMotion !== value) root.dataset.reducedMotion = value;
  });
}

/**
 * CRT binding (Story 1.32): the CRT mode in effect (`settings.crt`, OFF under
 * reduced motion) as `<html data-crt="scene|full|off">`, the hook Story 8.4's
 * scanlines and glow key off. Returns a disposer.
 */
export function bindCrt(root: HTMLElement, crt: ReadonlySignal<string>): () => void {
  return effect(() => {
    const value = crt.value;
    if (root.dataset.crt !== value) root.dataset.crt = value;
  });
}
