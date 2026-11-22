// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createSceneClock, type ClockEnv } from '../../../../src/ui/scenes/sceneClock';

/**
 * Story 8.6 (AR14, D11): `useSceneClock` runs one rAF loop for all scenes.
 * It stops when the page is hidden or reduced motion is on, and starts again
 * when neither holds. Driven here by a hand-cranked frame source.
 */

function fakeEnv() {
  const pending = new Map<number, (ts: number) => void>();
  let next = 1;
  let watchers: Array<() => void> = [];
  const env = {
    hidden: false,
    reduced: false,
    requestFrame(cb: (ts: number) => void) {
      const id = next++;
      pending.set(id, cb);
      return id;
    },
    cancelFrame(id: number) {
      pending.delete(id);
    },
    isHidden: () => env.hidden,
    isReducedMotion: () => env.reduced,
    watch(onChange: () => void) {
      watchers.push(onChange);
      return () => {
        watchers = watchers.filter((w) => w !== onChange);
      };
    },
  };
  let now = 0;
  return {
    env: env as typeof env & ClockEnv,
    /** Requested frames not yet run: one loop means at most one. */
    pending: () => pending.size,
    watchers: () => watchers.length,
    /** Run the frame that is due, `ms` after the last one. */
    frame(ms = 16) {
      now += ms;
      const due = [...pending.values()];
      pending.clear();
      for (const cb of due) cb(now);
    },
    change(patch: { hidden?: boolean; reduced?: boolean }) {
      Object.assign(env, patch);
      for (const w of watchers) w();
    },
  };
}

describe('sceneClock (Story 8.6)', () => {
  it('runs one loop for every scene that listens, and calls each of them every frame', () => {
    const f = fakeEnv();
    const clock = createSceneClock(f.env);
    const a: number[] = [];
    const b: number[] = [];
    clock.subscribe((t) => a.push(t));
    clock.subscribe((t) => b.push(t));
    expect(f.pending()).toBe(1);
    f.frame();
    f.frame();
    f.frame();
    expect(f.pending()).toBe(1);
    expect(a.length).toBe(3);
    expect(b).toEqual(a);
  });

  it('advances its visual time with the frames, never backwards', () => {
    const f = fakeEnv();
    const clock = createSceneClock(f.env);
    const seen: number[] = [];
    clock.subscribe((t) => seen.push(t));
    for (let i = 0; i < 5; i++) f.frame();
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    expect(clock.now()).toBe(seen[seen.length - 1]);
  });

  it('stops when nobody listens', () => {
    const f = fakeEnv();
    const clock = createSceneClock(f.env);
    const off = clock.subscribe(() => {});
    expect(clock.isRunning()).toBe(true);
    off();
    expect(clock.isRunning()).toBe(false);
    expect(f.pending()).toBe(0);
    expect(f.watchers()).toBe(0);
  });

  it('stops while the page is hidden, and goes on where it stopped when it shows again', () => {
    const f = fakeEnv();
    const clock = createSceneClock(f.env);
    let calls = 0;
    clock.subscribe(() => calls++);
    f.frame();
    f.change({ hidden: true });
    expect(clock.isRunning()).toBe(false);
    expect(f.pending()).toBe(0);
    const frozen = clock.now();
    const before = calls;
    f.frame(60_000);
    expect(calls).toBe(before);
    f.change({ hidden: false });
    expect(clock.isRunning()).toBe(true);
    f.frame(60_000);
    f.frame();
    expect(calls).toBeGreaterThan(before);
    // Time away is not visual time: no ant jumps ahead by the length of the absence.
    expect(clock.now() - frozen).toBeLessThan(60_000);
  });

  it('never starts under reduced motion, and stops when reduced motion comes on', () => {
    const f = fakeEnv();
    f.env.reduced = true;
    const clock = createSceneClock(f.env);
    let calls = 0;
    clock.subscribe(() => calls++);
    expect(clock.isRunning()).toBe(false);
    f.frame();
    expect(calls).toBe(0);
    f.change({ reduced: false });
    f.frame();
    expect(calls).toBe(1);
    f.change({ reduced: true });
    expect(clock.isRunning()).toBe(false);
    expect(f.pending()).toBe(0);
  });
});
