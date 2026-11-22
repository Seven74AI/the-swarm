import { useEffect, useRef } from 'preact/hooks';

/**
 * The scene clock (Story 8.6; AR14, D11): one requestAnimationFrame loop for
 * every scene on screen. It hands each listener the visual time (ms) once a
 * frame; a listener moves its own SVG nodes, so a frame re-renders nothing.
 *
 * The loop runs only while someone listens, the page is visible and reduced
 * motion is off. Visual time stands still while it is stopped and goes on
 * from there when it starts again, and one frame never moves it by more than
 * `FRAME_STEP_MAX_MS`, so no ant jumps after a stall or a hidden tab.
 *
 * Visual only: it reads and writes no game state (tests/arch/sceneBoundary.test.ts).
 */

/** What the clock needs from its page; `browserClockEnv` is the real one. */
export interface ClockEnv {
  requestFrame(cb: (ts: number) => void): number;
  cancelFrame(id: number): void;
  isHidden(): boolean;
  isReducedMotion(): boolean;
  /** Call back whenever the page may have been hidden or shown, or reduced motion turned on or off. Returns a disposer. */
  watch(onChange: () => void): () => void;
}

export interface SceneClock {
  /** The visual time (ms): frozen while the loop is stopped. */
  now(): number;
  /** Listen to every frame; returns the way to stop listening. */
  subscribe(onFrame: (t: number) => void): () => void;
  isRunning(): boolean;
}

/** The most one frame moves visual time (a stalled frame reads as one slow frame, never a jump). */
const FRAME_STEP_MAX_MS = 100;

export function createSceneClock(env: ClockEnv): SceneClock {
  const listeners = new Set<(t: number) => void>();
  let time = 0;
  let last: number | null = null;
  let frame: number | null = null;
  let unwatch: (() => void) | null = null;

  const tick = (ts: number) => {
    frame = null;
    time += last === null ? 0 : Math.min(FRAME_STEP_MAX_MS, Math.max(0, ts - last));
    last = ts;
    for (const fn of listeners) fn(time);
    if (frame === null && shouldRun()) frame = env.requestFrame(tick);
  };

  const shouldRun = () => listeners.size > 0 && !env.isHidden() && !env.isReducedMotion();

  const update = () => {
    if (shouldRun()) {
      if (frame === null) frame = env.requestFrame(tick);
    } else {
      if (frame !== null) env.cancelFrame(frame);
      frame = null;
      last = null;
    }
  };

  return {
    now: () => time,
    isRunning: () => frame !== null,
    subscribe(onFrame) {
      listeners.add(onFrame);
      unwatch ??= env.watch(update);
      update();
      return () => {
        listeners.delete(onFrame);
        if (listeners.size === 0) {
          unwatch?.();
          unwatch = null;
        }
        update();
      };
    },
  };
}

/**
 * The page's own clock environment: rAF, `document.hidden`, and reduced
 * motion as `<html data-reduced-motion>` (bound by main from the setting in
 * effect, Story 1.11), or the OS preference where nothing has bound it.
 */
export function browserClockEnv(doc: Document = document): ClockEnv {
  const win = doc.defaultView ?? window;
  const root = doc.documentElement;
  const query = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {
    requestFrame: (cb) => win.requestAnimationFrame(cb),
    cancelFrame: (id) => win.cancelAnimationFrame(id),
    isHidden: () => doc.visibilityState === 'hidden',
    isReducedMotion: () => {
      const bound = root.dataset.reducedMotion;
      return bound === undefined ? (query?.matches ?? false) : bound === 'true';
    },
    watch(onChange) {
      const observer = new MutationObserver(onChange);
      observer.observe(root, { attributes: true, attributeFilter: ['data-reduced-motion'] });
      doc.addEventListener('visibilitychange', onChange);
      query?.addEventListener?.('change', onChange);
      return () => {
        observer.disconnect();
        doc.removeEventListener('visibilitychange', onChange);
        query?.removeEventListener?.('change', onChange);
      };
    },
  };
}

let shared: SceneClock | null = null;

/** The one clock all scenes share (created on first use). */
export function sceneClock(): SceneClock {
  shared ??= createSceneClock(browserClockEnv());
  return shared;
}

/** Calls `onFrame(t)` every frame while the component is mounted (and the clock runs). */
export function useSceneClock(onFrame: (t: number) => void, clock: SceneClock = sceneClock()): void {
  const latest = useRef(onFrame);
  latest.current = onFrame;
  useEffect(() => clock.subscribe((t) => latest.current(t)), [clock]);
}
