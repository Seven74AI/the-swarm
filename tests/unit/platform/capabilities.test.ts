import { describe, expect, it } from 'vitest';
import { detectCapabilities, type CapabilityEnv } from '../../../src/platform/capabilities';

const media = (matching: string[]) => (q: string) => ({ matches: matching.includes(q) });
const NOTHING = {
  vibrate: false,
  standalone: false,
  reducedMotion: false,
  moreContrast: false,
  reducedTransparency: false,
  textScale: 1,
  mobile: false,
  audio: false,
};

describe('detectCapabilities (Story 1.10)', () => {
  it('reports nothing on an environment without navigator or matchMedia', () => {
    const caps = detectCapabilities({});
    expect(caps).toEqual(NOTHING);
  });

  it('detects vibrate only when navigator.vibrate is a function', () => {
    expect(detectCapabilities({ navigator: { vibrate: () => true } }).vibrate).toBe(true);
    expect(detectCapabilities({ navigator: { vibrate: 'yes' } }).vibrate).toBe(false);
  });

  it('reads standalone, reduced motion and more contrast from media queries', () => {
    const caps = detectCapabilities({
      matchMedia: media(['(display-mode: standalone)', '(prefers-reduced-motion: reduce)', '(prefers-contrast: more)']),
    });
    expect(caps).toMatchObject({ standalone: true, reducedMotion: true, moreContrast: true });
  });

  it('reads reduced transparency from its media query (Story 8.4)', () => {
    expect(detectCapabilities({ matchMedia: media(['(prefers-reduced-transparency: reduce)']) }).reducedTransparency).toBe(true);
    expect(detectCapabilities({ matchMedia: media([]) }).reducedTransparency).toBe(false);
  });

  it("reads the text scale from the root font size against the 16 px default (Story 8.4)", () => {
    const at = (fontSize: string) =>
      detectCapabilities({ document: { documentElement: {} }, getComputedStyle: () => ({ fontSize }) }).textScale;
    expect(at('16px')).toBe(1);
    expect(at('32px')).toBeGreaterThan(at('16px'));
    expect(at('12px')).toBeLessThan(1);
    // Unreadable sizes count as the default.
    expect(at('')).toBe(1);
    expect(at('0px')).toBe(1);
  });

  it("treats iOS's navigator.standalone as standalone", () => {
    expect(detectCapabilities({ navigator: { standalone: true }, matchMedia: media([]) }).standalone).toBe(true);
  });

  it('treats a coarse pointer as a mobile device (Story 2.12)', () => {
    expect(detectCapabilities({ matchMedia: media(['(pointer: coarse)']) }).mobile).toBe(true);
    expect(detectCapabilities({ matchMedia: media(['(pointer: fine)']) }).mobile).toBe(false);
  });

  it('detects Web Audio, prefixed or not (Story 8.8)', () => {
    expect(detectCapabilities({ AudioContext: class {} }).audio).toBe(true);
    expect(detectCapabilities({ webkitAudioContext: class {} }).audio).toBe(true);
    expect(detectCapabilities({ AudioContext: 'no' }).audio).toBe(false);
  });

  it('degrades to false and never throws when a probe throws', () => {
    const env: CapabilityEnv = {
      navigator: {
        get vibrate(): unknown {
          throw new Error('blocked');
        },
      },
      matchMedia: () => {
        throw new Error('no media');
      },
      document: { documentElement: {} },
      getComputedStyle: () => {
        throw new Error('no style');
      },
    };
    expect(() => detectCapabilities(env)).not.toThrow();
    expect(detectCapabilities(env)).toEqual(NOTHING);
  });

  it('is a snapshot taken once: later environment changes do not alter it', () => {
    const matching = ['(prefers-reduced-motion: reduce)'];
    const caps = detectCapabilities({ matchMedia: media(matching) });
    matching.length = 0;
    expect(caps.reducedMotion).toBe(true);
    expect(Object.isFrozen(caps)).toBe(true);
  });
});
