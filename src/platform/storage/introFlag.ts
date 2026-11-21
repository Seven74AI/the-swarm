/**
 * The intro (onboarding) flag (Story 2.2; D4: outside the save, its own key).
 *
 * Kept behind platform/ like the save, so game code never touches
 * `localStorage`. Blocked or missing storage never throws: the flag then
 * lasts the session.
 */
import type { RemovableStore } from './SaveStore';

export const INTRO_FLAG_KEY = 'the_swarm_onboarding';
/** The value an earlier build wrote once the intro was done (E2E seeds it). */
const DONE = 'done';

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
        return storage?.getItem(INTRO_FLAG_KEY) === DONE;
      } catch {
        return false;
      }
    },
    markDone() {
      session = true;
      try {
        storage?.setItem(INTRO_FLAG_KEY, DONE);
      } catch {
        // Storage is blocked or full: the flag lasts the session.
      }
    },
    reset() {
      session = false;
      try {
        storage?.removeItem(INTRO_FLAG_KEY);
      } catch {
        // Nothing stored to clear.
      }
    },
  };
}
