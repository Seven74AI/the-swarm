/**
 * Abbreviations are visual only (Story 1.33, UX-DR42; EXPERIENCE.md "Voice
 * and Tone"): every short form on screen has a full-word accessible name.
 *
 * The registry maps each short form the game prints to its full words. The
 * strip labels of `ui/shell/resourceCatalog.ts` and the tab labels of
 * `tabs.ts` are registered too (a test keeps them in step), so a cost line
 * like `10 CHTN · 5 VNOM` is read as "10 chitin · 5 venom".
 *
 * `spellOut()` gives the accessible text; `decorate()` in
 * `ui/primitives/Deco.tsx` draws each short form with its full word for
 * assistive tech (Story 1.32's `Abbr`).
 */
export const ABBREVIATIONS: Readonly<Record<string, string>> = {
  'LV.': 'level',
  LV: 'level',
  STR: 'strength',
  DEF: 'defense',
  SPD: 'speed',
  HP: 'hit points',
  DOT: 'damage over time',
  LP: 'legacy points',
  // Strip labels (resourceCatalog.ts) that are not words.
  LRVA: 'larvae',
  WRKR: 'workers',
  STON: 'stone',
  NECT: 'nectar',
  CHTN: 'chitin',
  VNOM: 'venom',
  VC: 'void crystals',
  ANTM: 'antimatter',
  DKMT: 'dark matter',
  SRVY: 'survey data',
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest first, so `LV.` wins over `LV`. A short form stands alone: not inside a longer word.
export const ABBREVIATION_PATTERN = new RegExp(
  `(?<=^|[^A-Za-z])(${Object.keys(ABBREVIATIONS)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|')})(?=$|[^A-Za-z])`,
  'g',
);
const PATTERN = ABBREVIATION_PATTERN;

/** `text` with every registered short form replaced by its full words. */
export function spellOut(text: string): string {
  // `LV.2` reads "level 2": a short form glued to a number gets a space.
  return text.replace(PATTERN, (short, _g, at: number) => {
    const next = text[at + short.length];
    return ABBREVIATIONS[short] + (next !== undefined && /[0-9]/.test(next) ? ' ' : '');
  });
}

/** True when `text` holds a registered short form. */
export function hasAbbreviation(text: string): boolean {
  PATTERN.lastIndex = 0;
  const found = PATTERN.test(text);
  PATTERN.lastIndex = 0;
  return found;
}
