/**
 * What assistive tech reads of an element (Story 1.32): its text with every
 * `aria-hidden` subtree left out. `.visually-hidden` text is kept (it is read).
 */
export function spokenText(el: Node): string {
  if (el.nodeType === Node.TEXT_NODE) return el.textContent ?? '';
  if (!(el instanceof Element)) return '';
  if (el.getAttribute('aria-hidden') === 'true') return '';
  // A control named by aria-label is read by that name, not its face (`[ CLOSE ]` → "Close").
  const label = el.getAttribute('aria-label');
  if (label !== null && el.matches('button, [role]')) return ` ${label} `;
  return [...el.childNodes].map(spokenText).join('');
}

/** The same text with runs of white space collapsed. */
export function spoken(el: Node): string {
  return spokenText(el).replace(/\s+/g, ' ').trim();
}

/** Typed decoration that must never be read out (UX-DR40). */
export const DECORATION = /[·█░▸▼▲→─-╿]|\[ | \]|^> /;

/** What a sighted player reads: the text without `.visually-hidden` spans. */
export function visibleText(el: Node): string {
  if (el.nodeType === Node.TEXT_NODE) return el.textContent ?? '';
  if (!(el instanceof Element)) return '';
  if (el.classList.contains('visually-hidden')) return '';
  return [...el.childNodes].map(visibleText).join('');
}

/** The description assistive tech reads for `el` (its `aria-describedby` targets, hidden or not). */
export function described(el: Element): string {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  return ids
    .map((id) => document.getElementById(id))
    .map((d) => (d ? [...d.childNodes].map(spokenText).join('') : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
