import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { bindHapticFeedback, bindSoundSetting } from '../../../src/platform/feedback';
import type { HapticPattern, Haptics } from '../../../src/platform/haptics';
import { createSettingsStore } from '../../../src/platform/settings';
import { EVENT_NAMES, EVENT_SAMPLES } from '../helpers/eventSamples';

const caps = { vibrate: true, standalone: false, reducedMotion: false, moreContrast: false, mobile: false };

function recorder(): Haptics & { played: HapticPattern[] } {
  const played: HapticPattern[] = [];
  return { played, play: (p) => void played.push(p) };
}

describe('haptic feedback wiring (Story 1.10, FR41)', () => {
  it('plays the juice-table patterns for egg, decision, battle and phase events', () => {
    const bus = new EventBus();
    const h = recorder();
    bindHapticFeedback(bus, h);
    bus.emit('egg_clicked', {});
    bus.emit('decision_spawned', EVENT_SAMPLES.decision_spawned);
    bus.emit('battle_completed', { ...EVENT_SAMPLES.battle_completed, victory: true });
    bus.emit('battle_completed', { ...EVENT_SAMPLES.battle_completed, victory: false });
    bus.emit('phase_committed', EVENT_SAMPLES.phase_committed);
    expect(h.played).toEqual(['light', 'light', 'medium', 'double', 'heavy']);
  });

  it('a win and a loss feel different', () => {
    const bus = new EventBus();
    const h = recorder();
    bindHapticFeedback(bus, h);
    bus.emit('battle_completed', { ...EVENT_SAMPLES.battle_completed, victory: true });
    bus.emit('battle_completed', { ...EVENT_SAMPLES.battle_completed, victory: false });
    expect(h.played[0]).not.toBe(h.played[1]);
  });

  it('no other event vibrates', () => {
    const bus = new EventBus();
    const h = recorder();
    bindHapticFeedback(bus, h);
    const felt = ['egg_clicked', 'decision_spawned', 'battle_completed', 'phase_committed'];
    for (const name of EVENT_NAMES.filter((n) => !felt.includes(n))) bus.emit(name, EVENT_SAMPLES[name] as never);
    expect(h.played).toEqual([]);
  });

  it('stops after unbinding', () => {
    const bus = new EventBus();
    const h = recorder();
    const unbind = bindHapticFeedback(bus, h);
    unbind();
    for (const name of EVENT_NAMES) bus.emit(name, EVENT_SAMPLES[name] as never);
    expect(h.played).toEqual([]);
  });
});

describe('sound setting wiring (Story 1.10)', () => {
  it('mutes audio while sound is off (the default) and follows changes', () => {
    const store = createSettingsStore({ storage: null, capabilities: caps });
    const audio = { muted: false };
    const unbind = bindSoundSetting(audio, store.settings);
    expect(audio.muted).toBe(true);
    store.update({ sound: true });
    expect(audio.muted).toBe(false);
    unbind();
    store.update({ sound: false });
    expect(audio.muted).toBe(false);
  });
});
