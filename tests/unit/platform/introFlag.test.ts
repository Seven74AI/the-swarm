// @vitest-environment node
/**
 * The intro flag (Story 2.2; Story 8.10): the title cinematic has been seen on
 * this device. Its own key, outside the save, behind platform/.
 */
import { describe, expect, it } from 'vitest';
import { INTRO_FLAG_KEY, LEGACY_ONBOARDING_KEY, createIntroFlag } from '../../../src/platform/storage/introFlag';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('intro flag', () => {
  it('lives in its own key, the_swarm_intro_seen, apart from the save', () => {
    const kv = memory();
    const flag = createIntroFlag(kv);
    expect(flag.done()).toBe(false);
    flag.markDone();
    expect(flag.done()).toBe(true);
    expect(INTRO_FLAG_KEY).toBe('the_swarm_intro_seen');
    expect(kv.data.has(INTRO_FLAG_KEY)).toBe(true);
    expect([...kv.data.keys()]).toEqual([INTRO_FLAG_KEY]);
    // A new flag on the same storage (the next launch) still reads it.
    expect(createIntroFlag(kv).done()).toBe(true);
  });

  it('reads the onboarding flag of an earlier build as seen: that device has started the game before', () => {
    for (const value of ['done', 'complete']) {
      const kv = memory();
      kv.setItem(LEGACY_ONBOARDING_KEY, value);
      expect(createIntroFlag(kv).done()).toBe(true);
    }
  });

  it('reads another value as not seen, and reset clears it', () => {
    const kv = memory();
    kv.setItem(INTRO_FLAG_KEY, 'nope');
    const flag = createIntroFlag(kv);
    expect(flag.done()).toBe(false);
    flag.markDone();
    flag.reset();
    expect(flag.done()).toBe(false);
  });

  it('works without storage (the flag lasts the session) and never throws', () => {
    const flag = createIntroFlag(null);
    expect(flag.done()).toBe(false);
    expect(() => flag.markDone()).not.toThrow();
    expect(flag.done()).toBe(true);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const blocked = createIntroFlag(throwing);
    expect(blocked.done()).toBe(false);
    expect(() => blocked.markDone()).not.toThrow();
    expect(blocked.done()).toBe(true);
    expect(() => blocked.reset()).not.toThrow();
  });
});
