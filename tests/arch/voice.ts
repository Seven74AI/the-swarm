/**
 * The voice rules (Story 1.33, UX-DR42; EXPERIENCE.md "Voice and Tone"), as
 * checks the voice tests share.
 *
 * - Nothing the player reads has an exclamation mark.
 * - Colony lines (event lines, narrative beats, the phase reveal line) are
 *   short, upper case and present tense, and end with a full stop.
 * - Interface copy is plain: no cheering, no "insufficient".
 * - No copy names a phase before the player has entered it.
 */
import { PHASE_ORDER, Phase } from '../../src/phases/phases';

/** Pictographs (emoji): the terminal shows typed glyphs, not stickers. */
const EMOJI = /\p{Extended_Pictographic}/u;
/** Past-tense helpers: colony lines say what happens now. */
const PAST_TENSE = /\b(WAS|WERE|HAD|DID|HAS BEEN|HAVE BEEN)\b/;
/** Slot-machine and error-dialog phrasing interface copy must not use. */
export const NOT_PLAIN = /\b(congratulations|welcome back|insufficient|awesome|amazing|hooray|woohoo|yay|epic)\b/i;

/** Why `line` breaks the colony voice, or null when it keeps it. */
export function colonyVoiceProblem(line: string): string | null {
  if (line.trim() !== line || line.length === 0) return 'is empty or padded';
  if (line.includes('!')) return 'has an exclamation mark';
  if (EMOJI.test(line)) return 'has an emoji';
  if (line !== line.toUpperCase()) return 'is not upper case';
  if (!line.endsWith('.')) return 'does not end with a full stop';
  if (PAST_TENSE.test(line)) return 'is not in the present tense';
  return null;
}

/**
 * The words that name each phase (the phase line's titles: THE COLONY, THE
 * WAR, THE EXPANSION, THE SPACE AGE, TRANSCENDENCE). The bare word "space"
 * is left out: it is also the space bar, which the settings name.
 */
export const PHASE_WORDS: Readonly<Record<Phase, RegExp>> = {
  [Phase.EGG_LAYING]: /\blonely queen\b/i,
  [Phase.COLONY]: /\bcolon(y|ies)\b/i,
  [Phase.COMBAT]: /\b(combat|war)\b/i,
  [Phase.EXPANSION]: /\bexpansion\b/i,
  [Phase.SPACE]: /\bspace (age|phase)\b/i,
  [Phase.TRANSCENDENCE]: /\btranscend\w*/i,
};

/** The phases after `phase`, in game order. */
export function laterPhases(phase: Phase): Phase[] {
  return PHASE_ORDER.slice(PHASE_ORDER.indexOf(phase) + 1);
}

/** The later phase `text` names when shown from `phase`, or null. */
export function namesLaterPhase(text: string, phase: Phase): Phase | null {
  return laterPhases(phase).find((p) => PHASE_WORDS[p].test(text)) ?? null;
}
