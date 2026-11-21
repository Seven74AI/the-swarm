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

const TOKEN = / · | → /;

/**
 * A typed line with its separators and arrows made decoration: `'A · B → C'`
 * looks the same but reads "A, B to C". Anything that isn't a string is
 * passed through as is.
 */
export function decorate(text: ComponentChildren): ComponentChildren {
  if (typeof text !== 'string' || !TOKEN.test(text)) return text;
  const out: ComponentChildren[] = [];
  let rest = text;
  let key = 0;
  for (let m = TOKEN.exec(rest); m; m = TOKEN.exec(rest)) {
    if (m.index > 0) out.push(rest.slice(0, m.index));
    out.push(m[0] === ' · ' ? <Sep key={key++} /> : <Arrow key={key++} />);
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push(rest);
  return out;
}
