/**
 * The intro flag (Story 2.2; Story 8.10, D4: outside the save, its own key):
 * the title cinematic has started on this device, so it never plays by
 * itself again (settings → REPLAY INTRO plays it on request).
 *
 * Kept behind platform/ like the save, so game code never touches
 * `localStorage`. Blocked or missing storage never throws: the flag then
 * lasts the session.
 */
import type { RemovableStore } from './SaveStore';

export const INTRO_FLAG_KEY = 'the_swarm_intro_seen';
/**
 * The onboarding flag an earlier build wrote (the tooltip intro that the
 * cinematic and the LAY EGG coach mark replace). Any value means this device
 * has started the game before: it reads as seen, and is never written again.
 */
export const LEGACY_ONBOARDING_KEY = 'the_swarm_onboarding';
const SEEN = 'seen';

export interface IntroFlag {
  done(): boolean;
  markDone(): void;
  reset(): void;
}

export function createIntroFlag(storage: RemovableStore | null): IntroFlag {
  let session = false;
  return {
    done() {
      if (session) return true;
      try {
        return storage?.getItem(INTRO_FLAG_KEY) === SEEN || (storage?.getItem(LEGACY_ONBOARDING_KEY) ?? null) !== null;
      } catch {
        return false;
      }
    },
    markDone() {
      session = true;
      try {
        storage?.setItem(INTRO_FLAG_KEY, SEEN);
      } catch {
        // Storage is blocked or full: the flag lasts the session.
      }
    },
    reset() {
      session = false;
      try {
        storage?.removeItem(INTRO_FLAG_KEY);
        storage?.removeItem(LEGACY_ONBOARDING_KEY);
      } catch {
        // Nothing stored to clear.
      }
    },
  };
}
