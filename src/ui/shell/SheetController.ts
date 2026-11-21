import { signal, type ReadonlySignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';

/**
 * `ui/shell/SheetController` (Story 1.14; AR10, D7, UX-DR22).
 *
 * One signal holds the open sheet and the queue of sheets waiting for it.
 * - Priority, highest first: offline summary > decision event > battle summary >
 *   other modal > peek (`SHEET_PRIORITIES`).
 * - Modal sheets never stack: one is open, the others wait in priority order
 *   (first come first served within a priority). A higher-priority modal sends a
 *   lower open one back to the head of its group, so two sheets requested together
 *   always show the higher one first, whatever the order of the calls.
 * - Opening a modal closes any open peek (it does not come back). A newer peek
 *   replaces an open peek; a peek waits behind an open modal.
 * - The element focused when a sheet is requested is its trigger: focus returns
 *   there on close. A sheet requested from inside another sheet inherits that
 *   sheet's trigger, since its own button is about to disappear.
 *
 * The controller knows nothing about game state: callers (main, UIRoot) turn bus
 * events into requests, and a sheet's buttons call actions.
 */

export const SHEET_PRIORITIES = ['offline', 'decision', 'battle', 'modal', 'peek'] as const;
export type SheetPriority = (typeof SHEET_PRIORITIES)[number];

export function isModal(priority: SheetPriority): boolean {
  return priority !== 'peek';
}

export interface SheetRequest {
  readonly priority: SheetPriority;
  /** Draws the sheet (a `ModalSheet` or `PeekSheet`); `close` closes this sheet. */
  readonly render: (close: () => void) => ComponentChildren;
  /** Runs once when the sheet closes, opened or not (closed, replaced, or dropped by a modal). */
  readonly onClose?: () => void;
}

export interface SheetEntry extends SheetRequest {
  readonly id: number;
  readonly trigger: HTMLElement | null;
}

export interface SheetState {
  readonly open: SheetEntry | null;
  readonly queue: readonly SheetEntry[];
}

export interface SheetController {
  readonly state: ReadonlySignal<SheetState>;
  /** Request a sheet; returns its id. It opens now or waits its turn. */
  open(request: SheetRequest): number;
  /** Close a sheet, open or waiting. The next waiting sheet opens. Unknown ids are ignored. */
  close(id: number): void;
}

const rank = (p: SheetPriority): number => SHEET_PRIORITIES.indexOf(p);

/** Insert by priority: after every entry of the same or higher priority (or before them, with `ahead`). */
function enqueue(queue: readonly SheetEntry[], entry: SheetEntry, ahead = false): readonly SheetEntry[] {
  const r = rank(entry.priority);
  let at = queue.findIndex((q) => (ahead ? rank(q.priority) >= r : rank(q.priority) > r));
  if (at < 0) at = queue.length;
  return [...queue.slice(0, at), entry, ...queue.slice(at)];
}

function focusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

export function createSheetController(): SheetController {
  const state = signal<SheetState>({ open: null, queue: [] });
  let nextId = 1;

  function triggerFor(current: SheetState): HTMLElement | null {
    const focused = focusedElement();
    if (focused?.closest('[data-sheet]')) return current.open?.trigger ?? null;
    return focused;
  }

  return {
    state,
    open(request) {
      const s = state.value;
      const entry: SheetEntry = { ...request, id: nextId++, trigger: triggerFor(s) };
      const closed: SheetEntry[] = [];
      let next: SheetState;
      if (!s.open) {
        next = { ...s, open: entry };
      } else if (!isModal(s.open.priority)) {
        // An open peek gives way to a modal or a newer peek; it doesn't wait.
        closed.push(s.open);
        next = { ...s, open: entry };
      } else if (isModal(entry.priority) && rank(entry.priority) < rank(s.open.priority)) {
        next = { open: entry, queue: enqueue(s.queue, s.open, true) };
      } else {
        next = { ...s, queue: enqueue(s.queue, entry) };
      }
      state.value = next;
      for (const c of closed) c.onClose?.();
      return entry.id;
    },
    close(id) {
      const s = state.value;
      if (s.open?.id === id) {
        const [head, ...rest] = s.queue;
        state.value = { open: head ?? null, queue: rest };
        s.open.onClose?.();
        return;
      }
      const waiting = s.queue.find((q) => q.id === id);
      if (!waiting) return;
      state.value = { ...s, queue: s.queue.filter((q) => q.id !== id) };
      waiting.onClose?.();
    },
  };
}
