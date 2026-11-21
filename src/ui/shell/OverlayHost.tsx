import { useCallback } from 'preact/hooks';
import type { OverlayController, OverlayEntry } from './OverlayController';

/**
 * Draws the playing overlay of the `OverlayController` (Story 1.20, D7), above
 * every sheet. Each overlay gets a fresh subtree (keyed by id), so its timers
 * start when it actually plays, not while it waits.
 */
export function OverlayHost({ overlays }: { overlays: OverlayController }) {
  const active = overlays.active.value;
  if (!active) return null;
  return <ActiveOverlay key={active.id} entry={active} overlays={overlays} />;
}

function ActiveOverlay({ entry, overlays }: { entry: OverlayEntry; overlays: OverlayController }) {
  const done = useCallback(() => overlays.end(entry.id), [entry, overlays]);
  return <>{entry.render(done)}</>;
}
