import { effect, signal, type ReadonlySignal } from '@preact/signals-core';
import { useEffect, useMemo } from 'preact/hooks';

/**
 * A scene's slow read of a fast signal (Story 8.5, AR14, D11): the state
 * changes up to 20 times a second, the scene redraws at most once per
 * `periodMs`.
 *
 * A change after a quiet period shows at once; changes during the period
 * after it wait, and the latest of them shows when the period ends. The
 * scene's container owns this copy (the scene itself only gets the value as
 * a prop); nothing here writes the game state.
 */
export interface ThrottledSignal<T> {
  readonly value: ReadonlySignal<T>;
  dispose(): void;
}

export function throttleSignal<T>(source: ReadonlySignal<T>, periodMs: number): ThrottledSignal<T> {
  const out = signal(source.peek());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let disposed = false;

  const publish = () => {
    pending = false;
    out.value = source.peek();
    timer = setTimeout(cool, periodMs);
  };
  const cool = () => {
    timer = null;
    if (pending && !disposed) publish();
  };

  let first = true;
  const stop = effect(() => {
    void source.value;
    if (first || disposed) {
      first = false;
      return;
    }
    if (timer === null) publish();
    else pending = true;
  });

  return {
    value: out,
    dispose() {
      disposed = true;
      stop();
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * `throttleSignal` for a component: a signal that follows `source` at most
 * once per `periodMs`, released on unmount. Read its `.value` in render.
 */
export function useThrottledSignal<T>(source: ReadonlySignal<T>, periodMs: number): ReadonlySignal<T> {
  const t = useMemo(() => throttleSignal(source, periodMs), [source, periodMs]);
  useEffect(() => () => t.dispose(), [t]);
  return t.value;
}
