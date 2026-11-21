import { useLayoutEffect, useRef } from 'preact/hooks';
import { effect, type ReadonlySignal } from '@preact/signals';
import type { OverlayController } from '../shell/OverlayController';
import './PausedOverlay.css';

/**
 * The PAUSED overlay line (Story 2.10; FR25, UX-DR33 paused, EXPERIENCE.md →
 * State Patterns → Paused).
 *
 * Full screen over the colony, on the overlay layer (so sheets wait behind it).
 * The next tap (pointer down anywhere) or key ends the pause. That tap or key
 * is swallowed: it reaches nothing behind the overlay, so a resuming Space
 * lays no egg and a resuming P doesn't pause again. A held key's repeats and
 * lone modifier keys don't count.
 *
 * The pause itself is session state owned by the resume path (in-session only:
 * hiding the page ends it); this only shows it and asks for the end.
 * Hooks: `[data-overlay="paused"]`, `[data-paused-line]`.
 */

export const PAUSED_LINE = 'PAUSED';
export const PAUSED_HINT = 'TAP OR PRESS ANY KEY TO RESUME.';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'OS']);

export function PausedOverlay({ done }: { done: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const doneRef = useRef(done);
  doneRef.current = done;

  useLayoutEffect(() => {
    root.current?.focus();
  }, []);

  // A layout effect, so the very next key after the overlay is drawn already resumes
  // (a plain effect waits for a frame, and a key in that frame would reach the game).
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || MODIFIERS.has(e.key)) return;
      doneRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div
      ref={root}
      class="paused-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paused-overlay-line"
      aria-describedby="paused-overlay-hint"
      tabIndex={-1}
      data-overlay="paused"
      onPointerDown={(e) => {
        e.preventDefault();
        doneRef.current();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <p id="paused-overlay-line" class="paused-overlay__line" data-paused-line="" data-display="">
        {PAUSED_LINE}
      </p>
      <p id="paused-overlay-hint" class="paused-overlay__hint">
        {PAUSED_HINT}
      </p>
    </div>
  );
}

export interface PausedOverlayDeps {
  /** Whether the game is paused (the resume path's session pause). */
  paused: ReadonlySignal<boolean>;
  overlays: OverlayController;
  /** End the pause (the resume path's `unpause`). */
  unpause: () => void;
}

/**
 * Shows the overlay while `paused` is true. A tap or key on it calls `unpause`;
 * a pause ended elsewhere (hiding the page) takes it down without calling it.
 */
export function bindPausedOverlay({ paused, overlays, unpause }: PausedOverlayDeps): () => void {
  let id: number | null = null;
  const dispose = effect(() => {
    const isPaused = paused.value;
    if (isPaused && id === null) {
      const mine: number = overlays.show({
        kind: 'paused',
        render: (done) => <PausedOverlay done={done} />,
        onEnd: () => {
          // Ended by a tap or key: end the pause too. Taken down here (id cleared first): nothing to do.
          if (id !== mine) return;
          id = null;
          unpause();
        },
      });
      id = mine;
    } else if (!isPaused && id !== null) {
      const ending = id;
      id = null;
      overlays.end(ending);
    }
  });
  return () => {
    dispose();
    if (id !== null) {
      const ending = id;
      id = null;
      overlays.end(ending);
    }
  };
}
