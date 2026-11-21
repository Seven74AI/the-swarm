// Installs the signals integration: a component that reads `selectX.value` re-renders when that
// slice changes, and only then (ADR 0004). Keep this import in the root of the Preact tree.
import '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';

/** The part of the legacy `UIRoot` that the Preact root needs. */
export interface LegacyUi {
  mount(container: HTMLElement): void;
}

/**
 * Root of the Preact UI (Story 1.7, ADR 0004).
 *
 * For now it only hosts the legacy `UIRoot`, unchanged, so panels can move to
 * Preact one at a time while their `data-*` / `id` selectors keep working.
 * The host box uses `display: contents`, so the legacy panels lay out as
 * direct children of `#app`, exactly as before.
 *
 * The legacy UI is mounted in a layout effect: Preact runs it synchronously
 * inside `render()`, so boot can reveal the phase's panels right after
 * rendering. The host has no Preact children, so re-renders never touch the
 * legacy DOM.
 */
export function App({ legacy }: { legacy: LegacyUi }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (host.current) legacy.mount(host.current);
    // Mount once per legacy UI; UIRoot has no unmount.
  }, [legacy]);
  return <div ref={host} data-legacy-ui="" style={{ display: 'contents' }} />;
}
