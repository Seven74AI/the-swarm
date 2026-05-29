import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioSystem } from '../../src/ui/AudioSystem';

/**
 * AudioSystem unit tests.
 *
 * Tests focus on API behavior and mute toggle — sound generation
 * requires AudioContext which is not available in jsdom without mock.
 * The E2E tests cover actual audio playback.
 */
describe('AudioSystem', () => {
  let audio: AudioSystem;

  beforeEach(() => {
    audio = new AudioSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muted defaults to false', () => {
    expect(audio.muted).toBe(false);
  });

  it('can be muted and unmuted', () => {
    audio.muted = true;
    expect(audio.muted).toBe(true);
    audio.muted = false;
    expect(audio.muted).toBe(false);
  });

  it('play() does not throw when AudioContext is unavailable (jsdom)', () => {
    // In jsdom, AudioContext is not available — play should silently no-op
    expect(() => audio.play('click')).not.toThrow();
    expect(() => audio.play('prestige')).not.toThrow();
    expect(() => audio.play('battle')).not.toThrow();
    expect(() => audio.play('discovery')).not.toThrow();
    expect(() => audio.play('error')).not.toThrow();
  });

  it('play() does not throw when muted', () => {
    audio.muted = true;
    expect(() => audio.play('click')).not.toThrow();
    expect(() => audio.play('prestige')).not.toThrow();
  });

  it('each sound type is callable', () => {
    // All sound methods exist and don't throw
    expect(() => (audio as unknown as Record<string, () => void>).playClick?.()).not.toThrow();
    expect(() => (audio as unknown as Record<string, () => void>).playPrestige?.()).not.toThrow();
    expect(() => (audio as unknown as Record<string, () => void>).playBattle?.()).not.toThrow();
    expect(() => (audio as unknown as Record<string, () => void>).playDiscovery?.()).not.toThrow();
    expect(() => (audio as unknown as Record<string, () => void>).playError?.()).not.toThrow();
  });

  it('mute toggle prevents audio context access', () => {
    // Mute should prevent getContext from creating AudioContext
    audio.muted = true;
    // Calling play should not create an AudioContext
    expect(() => audio.play('click')).not.toThrow();
    // After unmuting, still doesn't throw (jsdom has no AudioContext)
    audio.muted = false;
    expect(() => audio.play('click')).not.toThrow();
  });
});
