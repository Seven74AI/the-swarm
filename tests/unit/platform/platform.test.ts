import { describe, expect, it, vi } from 'vitest';
import { createWebPlatform } from '../../../src/platform';
import { SETTINGS_KEY } from '../../../src/platform/settings';

describe('createWebPlatform (Story 1.10)', () => {
  it('builds capabilities, settings and haptics from one environment', () => {
    const vibrate = vi.fn(() => true);
    const data: Record<string, string> = {};
    const p = createWebPlatform({
      navigator: { vibrate },
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) },
    });
    expect(p.capabilities.vibrate).toBe(true);
    expect(p.settings.settings.value.haptics).toBe(true);
    p.haptics.play('heavy');
    expect(vibrate).toHaveBeenCalledTimes(1);
    p.settings.update({ haptics: false });
    p.haptics.play('heavy');
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(data[SETTINGS_KEY]).toBeDefined();
  });

  it('boots on an environment with no browser APIs at all', () => {
    const p = createWebPlatform({});
    expect(p.capabilities.vibrate).toBe(false);
    expect(p.settings.settings.value.haptics).toBe(false);
    expect(() => p.haptics.play('double')).not.toThrow();
  });

  it('survives storage that throws on access', () => {
    const env = {
      get localStorage(): never {
        throw new Error('SecurityError');
      },
    };
    expect(() => createWebPlatform(env)).not.toThrow();
  });
});
