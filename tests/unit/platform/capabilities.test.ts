import { describe, expect, it } from 'vitest';
import { detectCapabilities, type CapabilityEnv } from '../../../src/platform/capabilities';

const media = (matching: string[]) => (q: string) => ({ matches: matching.includes(q) });

describe('detectCapabilities (Story 1.10)', () => {
  it('reports nothing on an environment without navigator or matchMedia', () => {
    const caps = detectCapabilities({});
    expect(caps).toEqual({ vibrate: false, standalone: false, reducedMotion: false, moreContrast: false, mobile: false, audio: false });
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
    };
    expect(() => detectCapabilities(env)).not.toThrow();
    expect(detectCapabilities(env)).toEqual({ vibrate: false, standalone: false, reducedMotion: false, moreContrast: false, mobile: false, audio: false });
  });

  it('is a snapshot taken once: later environment changes do not alter it', () => {
    const matching = ['(prefers-reduced-motion: reduce)'];
    const caps = detectCapabilities({ matchMedia: media(matching) });
    matching.length = 0;
    expect(caps.reducedMotion).toBe(true);
    expect(Object.isFrozen(caps)).toBe(true);
  });
});
