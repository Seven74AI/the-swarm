/**
 * Desktop focus order (Story 1.32, UX-DR40): in columns the visual order is
 * strip → rail → column 1 (NEST) and its primary action → columns 2–3 and
 * theirs, but the primary zones are one container after the columns in the
 * DOM (the phone layout pins them above the tab bar). The shell moves Tab and
 * Shift+Tab along this list instead; the phone layout keeps the DOM order,
 * which already reads strip → tab → primary action → tab bar.
 */

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';

function focusables(container: Element): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && !el.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
}

/** The shell's focusable controls, column by column. Hidden tabs and slots are skipped. */
export function columnFocusOrder(root: HTMLElement): HTMLElement[] {
  const one = (sel: string) => root.querySelector<HTMLElement>(sel);
  const all = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
  const wide = all('[data-tab-panel]').filter((p) => p.dataset.tabPanel !== 'nest');
  const containers = [
    one('[data-shell-strip]'),
    one('[data-tab-bar]'),
    one('[data-tab-panel="nest"]'),
    one('[data-primary-for="nest"]'),
    one('[data-primary-continue]'),
    ...wide.flatMap((p) => [p, one(`[data-primary-for="${p.dataset.tabPanel}"]`)]),
  ];
  return containers.filter((c): c is HTMLElement => c !== null && !c.hidden).flatMap(focusables);
}

/** Tab / Shift+Tab inside the shell follow `columnFocusOrder`; past either end the browser takes over. */
export function bindColumnFocus(root: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const order = columnFocusOrder(root);
    const i = order.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const next = order[i + (e.shiftKey ? -1 : 1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}
