/**
 * Typed decoration, hidden from assistive tech (Story 1.32, UX-DR40).
 *
 * The terminal look writes `·` separators, `→` level arrows, brackets,
 * glyphs and 4-letter abbreviations as text. A screen reader should hear the
 * words instead: each piece of decoration is drawn `aria-hidden`, and what it
 * means (a pause, "to", the full word) is in a `.visually-hidden` span next to
 * it. Sighted players see exactly the same characters as before.
 */
import type { ComponentChildren } from 'preact';
import { ABBREVIATIONS, ABBREVIATION_PATTERN } from '../../data/content/abbreviations';

/** A short form on screen, the full word for assistive tech ("CHTN" → "Chitin", "◊" → "Food"). */
export function Abbr({ shown, full }: { shown: ComponentChildren; full: string }) {
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span class="visually-hidden">{full}</span>
    </>
  );
}

/** ` · ` on screen; a comma (a pause) for a screen reader. */
export function Sep() {
  return (
    <>
      {' '}
      <span aria-hidden="true">·</span>
      <span class="visually-hidden">,</span>{' '}
    </>
  );
}

/** ` → ` on screen; " to " for a screen reader ("LV.2 → 3" reads "LV.2 to 3"). */
export function Arrow() {
  return (
    <>
      {' '}
      <span aria-hidden="true">→</span>
      <span class="visually-hidden">to</span>{' '}
    </>
  );
}

/** A separator, an arrow, or a registered short form (`LV.`, `STR`, `CHTN`; Story 1.33). */
const TOKEN = new RegExp(` · | → |${ABBREVIATION_PATTERN.source}`);

/**
 * A typed line with its decoration made visual only: `'LV.2 → 3 · 5 CHTN'`
 * looks the same but reads "level 2 to 3, 5 chitin". Separators and arrows
 * (Story 1.32) and the short forms of `data/content/abbreviations.ts`
 * (Story 1.33) are replaced. Anything that isn't a string is passed through
 * as is.
 */
export function decorate(text: ComponentChildren): ComponentChildren {
  if (typeof text !== 'string' || !TOKEN.test(text)) return text;
  const out: ComponentChildren[] = [];
  let rest = text;
  let key = 0;
  for (let m = TOKEN.exec(rest); m; m = TOKEN.exec(rest)) {
    if (m.index > 0) out.push(rest.slice(0, m.index));
    if (m[0] === ' · ') out.push(<Sep key={key++} />);
    else if (m[0] === ' → ') out.push(<Arrow key={key++} />);
    else {
      // `LV.2` reads "level 2": a short form glued to a number keeps a space before it.
      const glued = /^[0-9]/.test(rest.slice(m.index + m[0].length));
      out.push(<Abbr key={key++} shown={m[0]} full={glued ? `${ABBREVIATIONS[m[0]]} ` : ABBREVIATIONS[m[0]]} />);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push(rest);
  return out;
}
