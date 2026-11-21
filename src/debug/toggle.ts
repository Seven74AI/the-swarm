/**
 * What opens and closes the debug overlay (Story 1.34, AR24): the backtick key,
 * or three fingers held on the screen for LONG_PRESS_MS (fingers may drift;
 * lifting one, or a fourth finger, cancels).
 */

/** How long three fingers must stay down. */
export const LONG_PRESS_MS = 800;
const TOGGLE_KEY = '`';
const FINGERS = 3;

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches('input, textarea, select');
}

/** Listen on `target` (the window); returns the unbind. */
export function bindDebugToggle(target: Window, toggle: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const fingers = (e: Event): number => (e as TouchEvent).touches?.length ?? 0;

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== TOGGLE_KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    e.preventDefault();
    toggle();
  };
  const onTouchStart = (e: Event): void => {
    if (fingers(e) !== FINGERS) {
      cancel();
      return;
    }
    cancel();
    timer = setTimeout(() => {
      timer = null;
      toggle();
    }, LONG_PRESS_MS);
  };
  const onTouchEnd = (e: Event): void => {
    if (fingers(e) < FINGERS) cancel();
  };

  target.addEventListener('keydown', onKey);
  target.addEventListener('touchstart', onTouchStart, { passive: true });
  target.addEventListener('touchend', onTouchEnd, { passive: true });
  target.addEventListener('touchcancel', cancel, { passive: true });
  return () => {
    cancel();
    target.removeEventListener('keydown', onKey);
    target.removeEventListener('touchstart', onTouchStart);
    target.removeEventListener('touchend', onTouchEnd);
    target.removeEventListener('touchcancel', cancel);
  };
}
