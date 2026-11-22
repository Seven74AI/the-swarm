/**
 * Device capabilities (Story 1.10, AR12/D9).
 *
 * Detected once at boot by main and passed on. Every probe degrades to
 * `false` (the text scale to 1): a missing or throwing API never crashes the game.
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
  /** The OS asks for reduced transparency (Story 8.4: CRT effects start OFF). */
  readonly reducedTransparency: boolean;
  /** The player's text size at boot: the root font size against the 16 px default (1 when unreadable). */
  readonly textScale: number;
  /** A touch-first device (`(pointer: coarse)`): a phone or tablet (Story 2.12's home-screen hint). */
  readonly mobile: boolean;
}

/** The parts of `window` the probes read; a plain object in tests. */
export interface CapabilityEnv {
  readonly navigator?: { readonly vibrate?: unknown; readonly standalone?: unknown };
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
  readonly document?: { readonly documentElement?: unknown };
  readonly getComputedStyle?: (el: never) => { readonly fontSize: string };
}

/** The browser's default root font size, against which the text scale is measured. */
const DEFAULT_ROOT_PX = 16;

function readTextScale(env: CapabilityEnv): number {
  try {
    const root = env.document?.documentElement;
    if (!root || typeof env.getComputedStyle !== 'function') return 1;
    const px = parseFloat(env.getComputedStyle(root as never).fontSize);
    return Number.isFinite(px) && px > 0 ? px / DEFAULT_ROOT_PX : 1;
  } catch {
    return 1;
  }
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
    reducedTransparency: mediaMatches(env, '(prefers-reduced-transparency: reduce)'),
    textScale: readTextScale(env),
    mobile: mediaMatches(env, '(pointer: coarse)'),
  });
}
