import { computed, signal, type ReadonlySignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';

/**
 * `ui/shell/OverlayController` (Story 1.20; AR10, D7).
 *
 * The overlay layer: the phase reveal now, the title cinematic and the
 * Transcendence ending later. An overlay is full screen and blocks input.
 * - One overlay plays at a time; others wait in request order.
 * - `held` is true while one is up: the SheetHost draws no sheet meanwhile, so
 *   decision events and other sheets requested during an overlay wait until it ends
 *   (their subtree, and so their timers, start only when they are drawn).
 * - The root (`<html>` in the game) carries `data-overlay-active="<kind>"` from the moment
 *   an overlay is requested, synchronously. CSS keyed to it (the phase reveal's
 *   palette cross-fade) is part of the same style pass as the phase change.
 *
 * Like the SheetController it knows nothing about game state: callers turn bus
 * events into requests (`bindPhaseReveal`).
 */

export type OverlayKind = 'phase-reveal';

export interface OverlayRequest {
  readonly kind: OverlayKind;
  /** Draws the overlay; `done` ends it. */
  readonly render: (done: () => void) => ComponentChildren;
  /** Runs once when the overlay ends (played out, skipped, or dropped while waiting). */
  readonly onEnd?: () => void;
}

export interface OverlayEntry extends OverlayRequest {
  readonly id: number;
}

export interface OverlayController {
  readonly active: ReadonlySignal<OverlayEntry | null>;
  /** True while an overlay is up: sheets and decision events wait. */
  readonly held: ReadonlySignal<boolean>;
  /** Request an overlay; returns its id. It plays now or after the ones before it. */
  show(request: OverlayRequest): number;
  /** End an overlay, playing or waiting. Unknown ids are ignored. */
  end(id: number): void;
}

export function createOverlayController(root?: HTMLElement): OverlayController {
  const state = signal<{ active: OverlayEntry | null; queue: readonly OverlayEntry[] }>({ active: null, queue: [] });
  const active = computed(() => state.value.active);
  const held = computed(() => state.value.active !== null);
  let nextId = 1;

  const mark = (entry: OverlayEntry | null): void => {
    if (!root) return;
    if (entry) root.dataset.overlayActive = entry.kind;
    else delete root.dataset.overlayActive;
  };

  return {
    active,
    held,
    show(request) {
      const entry: OverlayEntry = { ...request, id: nextId++ };
      const s = state.value;
      if (s.active) {
        state.value = { ...s, queue: [...s.queue, entry] };
      } else {
        mark(entry);
        state.value = { ...s, active: entry };
      }
      return entry.id;
    },
    end(id) {
      const s = state.value;
      if (s.active?.id === id) {
        const [head, ...rest] = s.queue;
        mark(head ?? null);
        state.value = { active: head ?? null, queue: rest };
        s.active.onEnd?.();
        return;
      }
      const waiting = s.queue.find((q) => q.id === id);
      if (!waiting) return;
      state.value = { ...s, queue: s.queue.filter((q) => q.id !== id) };
      waiting.onEnd?.();
    },
  };
}
