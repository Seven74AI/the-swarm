/**
 * Tips on `[data-tooltip]` elements (Story 1.30; UX-DR41, WCAG 1.4.13).
 *
 * Hover shows exactly what a tap shows: the bubble (`main.css`) shows on hover
 * (only on devices that hover), on keyboard focus, and while `data-tip-open` is
 * set, which a tap toggles. One tip is open at a time; a tap elsewhere closes it.
 * The bubble takes the pointer, so it stays while the pointer moves onto it.
 * Esc dismisses a showing tip without moving the pointer or focus
 * (`data-tip-dismissed` until the pointer or focus leaves) and consumes the key,
 * so the close shortcut doesn't also close a sheet. This is the tip's own
 * dismissal, not a shortcut: it works with shortcuts switched off.
 */

const TIP = '[data-tooltip]';

export function bindTips(root: Document = document): () => void {
  let open: HTMLElement | null = null;
  let hovered: HTMLElement | null = null;

  const tipOf = (t: EventTarget | null): HTMLElement | null =>
    t instanceof Element ? (t.closest<HTMLElement>(TIP) ?? null) : null;

  const setOpen = (el: HTMLElement | null): void => {
    if (open && open !== el) open.removeAttribute('data-tip-open');
    open = el;
    if (el) {
      el.removeAttribute('data-tip-dismissed');
      el.setAttribute('data-tip-open', '');
    }
  };

  const onClick = (e: MouseEvent): void => {
    const tip = tipOf(e.target);
    setOpen(tip && tip !== open ? tip : null);
  };

  const onOver = (e: PointerEvent): void => {
    hovered = tipOf(e.target);
  };

  const onLeave = (e: Event): void => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches(TIP)) return;
    el.removeAttribute('data-tip-dismissed');
    if (hovered === el) hovered = null;
  };

  const onFocusOut = (e: FocusEvent): void => {
    const tip = tipOf(e.target);
    if (tip && !tip.contains(e.relatedTarget as Node | null)) tip.removeAttribute('data-tip-dismissed');
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    const focused = tipOf(root.activeElement);
    const showing = [open, hovered, focused].filter(
      (el, i, all): el is HTMLElement => el !== null && el.isConnected && all.indexOf(el) === i && !el.hasAttribute('data-tip-dismissed'),
    );
    if (showing.length === 0) return;
    e.preventDefault();
    for (const el of showing) {
      el.removeAttribute('data-tip-open');
      el.setAttribute('data-tip-dismissed', '');
    }
    open = null;
  };

  root.addEventListener('click', onClick);
  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerleave', onLeave, true);
  root.addEventListener('focusout', onFocusOut);
  // Capture: runs before the shortcuts' listener, which skips a consumed key.
  root.addEventListener('keydown', onKey, true);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerleave', onLeave, true);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('keydown', onKey, true);
  };
}
