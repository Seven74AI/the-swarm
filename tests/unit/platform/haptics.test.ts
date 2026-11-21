import { describe, expect, it, vi } from 'vitest';
import { HAPTIC_PATTERNS, createWebHaptics, type HapticPattern } from '../../../src/platform/haptics';

const ALL: HapticPattern[] = ['light', 'medium', 'heavy', 'double'];

describe('web Haptics (Story 1.10)', () => {
  it('calls navigator.vibrate with each pattern, as a method of navigator', () => {
    const nav = { vibrate: vi.fn(function (this: unknown, _ms: number | number[]) { return this === nav; }) };
    const haptics = createWebHaptics({ navigator: nav, enabled: () => true });
    for (const p of ALL) haptics.play(p);
    expect(nav.vibrate.mock.calls.map((c) => c[0])).toEqual(ALL.map((p) => HAPTIC_PATTERNS[p]));
    expect(nav.vibrate.mock.results.every((r) => r.value === true)).toBe(true);
  });

  it('gives every pattern a distinct, non-empty vibration of whole milliseconds', () => {
    const flat = ALL.map((p) => [HAPTIC_PATTERNS[p]].flat());
    for (const ms of flat) {
      expect(ms.length).toBeGreaterThan(0);
      expect(ms.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    }
    expect(new Set(flat.map((ms) => ms.join(','))).size).toBe(ALL.length);
    expect([HAPTIC_PATTERNS.double].flat().length).toBeGreaterThan(1);
  });

  it('is a no-op where vibrate is missing', () => {
    for (const navigator of [undefined, {}, { vibrate: 'nope' }]) {
      const haptics = createWebHaptics({ navigator, enabled: () => true });
      for (const p of ALL) expect(() => haptics.play(p)).not.toThrow();
    }
  });

  it('never throws, even when vibrate throws', () => {
    const nav = { vibrate: vi.fn(() => { throw new Error('denied'); }) };
    const haptics = createWebHaptics({ navigator: nav, enabled: () => true });
    for (const p of ALL) expect(() => haptics.play(p)).not.toThrow();
    expect(nav.vibrate).toHaveBeenCalled();
  });

  it('respects the haptics setting, read at each call', () => {
    let on = false;
    const nav = { vibrate: vi.fn(() => true) };
    const haptics = createWebHaptics({ navigator: nav, enabled: () => on });
    haptics.play('light');
    expect(nav.vibrate).not.toHaveBeenCalled();
    on = true;
    haptics.play('light');
    expect(nav.vibrate).toHaveBeenCalledTimes(1);
  });
});
