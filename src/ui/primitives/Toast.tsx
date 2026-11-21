/**
 * Toast primitive (Story 1.12, UX-DR29).
 *
 * One line, for 2 s, replacing any earlier toast. A toast is never the only
 * place something the player must act on appears; callers also write it to
 * the log or a sheet. `createToasts()` is the queue-of-one; `ToastHost`
 * draws it (on `raised` with a 1 px `accent` border, above the primary zone).
 */
import './Toast.css';
import { signal, type ReadonlySignal } from '@preact/signals';

export const TOAST_MS = 2000;

export interface ToastItem {
  /** Increases with each toast, so a replacement re-renders and restarts its timer. */
  readonly id: number;
  readonly text: string;
}

export interface Toasts {
  readonly current: ReadonlySignal<ToastItem | null>;
  /** Show `text` (one line) for `TOAST_MS`, replacing any toast on screen. */
  show(text: string): void;
  clear(): void;
}

export function createToasts(durationMs: number = TOAST_MS): Toasts {
  const current = signal<ToastItem | null>(null);
  let nextId = 1;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    current.value = null;
  };
  return {
    current,
    clear,
    show(text) {
      if (timer !== null) clearTimeout(timer);
      current.value = { id: nextId++, text: text.replace(/\s*\n\s*/g, ' ').trim() };
      timer = setTimeout(clear, durationMs);
    },
  };
}

export function ToastHost({ toasts }: { toasts: Toasts }) {
  const item = toasts.current.value;
  return (
    <div class="toast-host" aria-live="polite" role="status">
      {item && (
        <p key={item.id} class="toast" data-toast="">
          {item.text}
        </p>
      )}
    </div>
  );
}
