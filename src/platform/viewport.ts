/**
 * The viewport class (Story 1.29, UX-DR6): wide (≥ 1024 px, the desktop
 * columns) or not. One signal, kept in step with the media query, so the tab
 * shell and the CSS agree on the layout. Below 1024 px the game is the single
 * column (centred at 600 px from 600 px up).
 */
import { signal, type ReadonlySignal } from '@preact/signals-core';

/** From this width on, the desktop rail and columns replace the tab bar (UX-DR6). */
export const DESKTOP_MIN_WIDTH_PX = 1024;
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;

export interface Viewport {
  /** True at ≥ 1024 px of viewport width. */
  readonly wide: ReadonlySignal<boolean>;
  dispose(): void;
}

interface MediaList {
  readonly matches: boolean;
  addEventListener?(type: 'change', listener: () => void): void;
  removeEventListener?(type: 'change', listener: () => void): void;
}

/** The part of `window` the viewport reads; a plain object in tests. */
export interface ViewportEnv {
  readonly matchMedia?: (query: string) => MediaList;
}

/** Missing or throwing media queries give a narrow viewport: the phone layout works everywhere. */
export function createViewport(env: ViewportEnv = typeof window === 'undefined' ? {} : window): Viewport {
  let media: MediaList | null = null;
  try {
    media = typeof env.matchMedia === 'function' ? env.matchMedia(DESKTOP_QUERY) : null;
  } catch {
    media = null;
  }
  const read = (): boolean => {
    try {
      return media?.matches === true;
    } catch {
      return false;
    }
  };
  const wide = signal(read());
  const onChange = () => {
    wide.value = read();
  };
  try {
    media?.addEventListener?.('change', onChange);
  } catch {
    // No change events: the layout stays as it booted.
  }
  return {
    wide,
    dispose() {
      try {
        media?.removeEventListener?.('change', onChange);
      } catch {
        // Nothing to undo.
      }
    },
  };
}
