/**
 * Haptics (Story 1.10, FR41, D9).
 *
 * An enhancement, never the only feedback. The web implementation calls
 * `navigator.vibrate` where it exists and is a no-op otherwise; it never
 * throws. A Capacitor implementation can replace it for a store build.
 */
export type HapticPattern = 'light' | 'medium' | 'heavy' | 'double';

export interface Haptics {
  play(pattern: HapticPattern): void;
}

/** Vibration per pattern, in whole milliseconds (`[on, off, on]` for double). */
export const HAPTIC_PATTERNS: Readonly<Record<HapticPattern, number | readonly number[]>> = Object.freeze({
  light: 10,
  medium: 25,
  heavy: 50,
  double: Object.freeze([10, 60, 10]),
});

export const noopHaptics: Haptics = Object.freeze({ play: () => {} });

export interface WebHapticsDeps {
  /** Usually `window.navigator`; anything without a `vibrate` function makes a no-op. */
  readonly navigator?: { readonly vibrate?: unknown };
  /** The haptics setting, read at each call. */
  readonly enabled: () => boolean;
}

export function createWebHaptics({ navigator, enabled }: WebHapticsDeps): Haptics {
  return {
    play(pattern) {
      try {
        if (!enabled()) return;
        const vibrate = navigator?.vibrate;
        if (typeof vibrate !== 'function') return;
        const ms = HAPTIC_PATTERNS[pattern];
        // Called as a method: browsers throw "Illegal invocation" on a detached vibrate.
        vibrate.call(navigator, typeof ms === 'number' ? ms : [...ms]);
      } catch {
        // Haptics must never break the game.
      }
    },
  };
}
