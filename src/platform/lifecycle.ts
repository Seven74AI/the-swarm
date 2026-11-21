/**
 * Page lifecycle (Story 2.3, D1): the browser's page events as two signals.
 *
 * - `hidden`: `visibilitychange` to hidden, or `pagehide` (closing, or going
 *   into the back/forward cache).
 * - `returned`: `visibilitychange` to visible, `pageshow` (a back/forward cache
 *   return) or window `focus` (after the device slept), only while the
 *   document is visible.
 *
 * Signals come in bursts; main hands them to the one resume path, which
 * applies each gap once. `beforeunload` stays in main as a fallback save only.
 */
export interface LifecycleHandlers {
  hidden(): void;
  returned(): void;
}

export interface Lifecycle {
  /** Start listening; returns the unbind function. */
  bind(handlers: LifecycleHandlers): () => void;
}

interface Listenable {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface LifecycleEnv {
  readonly document?: Listenable & { readonly visibilityState: string };
  readonly addEventListener?: Listenable['addEventListener'];
  readonly removeEventListener?: Listenable['removeEventListener'];
}

export function createLifecycle(env: LifecycleEnv = typeof window === 'undefined' ? {} : window): Lifecycle {
  return {
    bind(handlers) {
      const doc = env.document;
      const visible = (): boolean => doc?.visibilityState !== 'hidden';
      const onVisibility = (): void => {
        if (visible()) handlers.returned();
        else handlers.hidden();
      };
      const onHide = (): void => handlers.hidden();
      const onReturn = (): void => {
        if (visible()) handlers.returned();
      };
      const win: Array<[string, () => void]> = [
        ['pagehide', onHide],
        ['pageshow', onReturn],
        ['focus', onReturn],
      ];
      doc?.addEventListener('visibilitychange', onVisibility);
      for (const [type, fn] of win) env.addEventListener?.(type, fn);
      return () => {
        doc?.removeEventListener('visibilitychange', onVisibility);
        for (const [type, fn] of win) env.removeEventListener?.(type, fn);
      };
    },
  };
}
