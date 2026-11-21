import { describe, expect, it } from 'vitest';
import { createViewport, DESKTOP_MIN_WIDTH_PX } from '../../../src/platform/viewport';

/** A matchMedia stand-in whose `matches` the test flips, firing `change` listeners. */
function fakeMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  const env = {
    matchMedia(query: string) {
      queries.push(query);
      return {
        get matches() {
          return matches;
        },
        addEventListener: (_: 'change', l: () => void) => listeners.add(l),
        removeEventListener: (_: 'change', l: () => void) => listeners.delete(l),
      };
    },
  };
  const set = (m: boolean) => {
    matches = m;
    for (const l of listeners) l();
  };
  return { env, set, queries, listeners };
}

describe('createViewport (Story 1.29)', () => {
  it('reports a wide viewport from the desktop media query', () => {
    const m = fakeMedia(true);
    const vp = createViewport(m.env);
    expect(vp.wide.value).toBe(true);
    expect(m.queries.some((q) => q.includes(`${DESKTOP_MIN_WIDTH_PX}px`))).toBe(true);
  });

  it('follows the viewport when it crosses the breakpoint', () => {
    const m = fakeMedia(false);
    const vp = createViewport(m.env);
    expect(vp.wide.value).toBe(false);
    m.set(true);
    expect(vp.wide.value).toBe(true);
    m.set(false);
    expect(vp.wide.value).toBe(false);
  });

  it('stops listening once disposed', () => {
    const m = fakeMedia(false);
    const vp = createViewport(m.env);
    vp.dispose();
    expect(m.listeners.size).toBe(0);
  });

  it('is narrow where matchMedia is missing or throws', () => {
    expect(createViewport({}).wide.value).toBe(false);
    const throwing = {
      matchMedia(): never {
        throw new Error('nope');
      },
    };
    expect(createViewport(throwing).wide.value).toBe(false);
  });
});
