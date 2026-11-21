/**
 * Device capabilities (Story 1.10, AR12/D9).
 *
 * Detected once at boot by main and passed on. Every probe degrades to
 * `false`: a missing or throwing API never crashes the game.
 */
export interface Capabilities {
  /** `navigator.vibrate` exists (not on iOS Safari). */
  readonly vibrate: boolean;
  /** Running as an installed home-screen app. */
  readonly standalone: boolean;
  /** The OS asks for reduced motion. */
  readonly reducedMotion: boolean;
  /** The OS asks for more contrast. */
  readonly moreContrast: boolean;
}

/** The parts of `window` the probes read; a plain object in tests. */
export interface CapabilityEnv {
  readonly navigator?: { readonly vibrate?: unknown; readonly standalone?: unknown };
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
}

function probe(read: () => boolean): boolean {
  try {
    return read();
  } catch {
    return false;
  }
}

function mediaMatches(env: CapabilityEnv, query: string): boolean {
  return probe(() => typeof env.matchMedia === 'function' && env.matchMedia(query).matches === true);
}

/** Take the one capability snapshot. Defaults to the browser's `window`. */
export function detectCapabilities(env: CapabilityEnv = typeof window === 'undefined' ? {} : window): Capabilities {
  return Object.freeze({
    vibrate: probe(() => typeof env.navigator?.vibrate === 'function'),
    standalone:
      mediaMatches(env, '(display-mode: standalone)') || probe(() => env.navigator?.standalone === true),
    reducedMotion: mediaMatches(env, '(prefers-reduced-motion: reduce)'),
    moreContrast: mediaMatches(env, '(prefers-contrast: more)'),
  });
}
