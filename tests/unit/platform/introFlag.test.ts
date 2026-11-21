// @vitest-environment node
/** The intro (onboarding) flag (Story 2.2): its own key, outside the save, behind platform/. */
import { describe, expect, it } from 'vitest';
import { INTRO_FLAG_KEY, createIntroFlag } from '../../../src/platform/storage/introFlag';

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
  it('keeps the existing key and value', () => {
    const kv = memory();
    const flag = createIntroFlag(kv);
    expect(flag.done()).toBe(false);
    flag.markDone();
    expect(flag.done()).toBe(true);
    expect(kv.data.get(INTRO_FLAG_KEY)).toBe('done');
    expect(INTRO_FLAG_KEY).toBe('the_swarm_onboarding');
  });

  it('reads another value as not done, and reset clears it', () => {
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
    expect(() => blocked.reset()).not.toThrow();
  });
});
