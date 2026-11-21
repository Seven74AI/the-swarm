// @vitest-environment node
/** The telemetry store (Story 3.10): its own key, outside the save, behind platform/. */
import { describe, expect, it } from 'vitest';
import { TELEMETRY_KEY, createTelemetryStore } from '../../../src/platform/storage/telemetryStore';
import { SAVE_KEYS } from '../../../src/platform/storage/SaveStore';
import { createWebPlatform } from '../../../src/platform';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('telemetry store (Story 3.10)', () => {
  it('reads and writes one key of its own, never a save key', () => {
    const kv = memory();
    const store = createTelemetryStore(kv);
    expect(store.read()).toBeNull();
    expect(store.write('{"a":1}')).toBe(true);
    expect(store.read()).toBe('{"a":1}');
    expect([...kv.data.keys()]).toEqual([TELEMETRY_KEY]);
    expect(Object.values(SAVE_KEYS)).not.toContain(TELEMETRY_KEY);
  });

  it('works without storage and never throws when storage is blocked', () => {
    expect(createTelemetryStore(null).read()).toBeNull();
    expect(createTelemetryStore(null).write('x')).toBe(false);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createTelemetryStore(blocked);
    expect(store.read()).toBeNull();
    expect(store.write('x')).toBe(false);
  });

  it('is platform.telemetry, on the same storage as the save', () => {
    const kv = memory();
    const p = createWebPlatform({ localStorage: kv });
    p.telemetry.write('t');
    expect(kv.data.get(TELEMETRY_KEY)).toBe('t');
  });
});
