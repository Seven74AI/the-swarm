import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindHapticFeedback, bindSoundFeedback, SOUND_EVENTS } from '../../../src/platform/feedback';
import { SOUND_CUES, type Audio, type SoundCue } from '../../../src/platform/audio';
import type { HapticPattern, Haptics } from '../../../src/platform/haptics';
import { EVENT_NAMES, EVENT_SAMPLES } from '../helpers/eventSamples';


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

describe('sound feedback wiring (Story 8.8, FR42)', () => {
  function audioRecorder(): Audio & { played: SoundCue[] } {
    const played: SoundCue[] = [];
    return { played, muted: false, available: true, play: (c) => void played.push(c) };
  }
  const bind = (start = { workers: 5, larvae: 5 }) => {
    const bus = new EventBus();
    const a = audioRecorder();
    const unbind = bindSoundFeedback(bus, a, start);
    return { bus, a, unbind };
  };

  it('plays the key click, battle result, phase tone and decision chime for their events', () => {
    const { bus, a } = bind();
    bus.emit('egg_clicked', {});
    bus.emit('upgrade_purchased', EVENT_SAMPLES.upgrade_purchased);
    bus.emit('building_complete', EVENT_SAMPLES.building_complete);
    bus.emit('battle_completed', { ...EVENT_SAMPLES.battle_completed, victory: true, outcome: 'victory' });
    bus.emit('battle_completed', { ...EVENT_SAMPLES.battle_completed, victory: false, outcome: 'defeat' });
    bus.emit('battle_completed', { ...EVENT_SAMPLES.battle_completed, victory: false, outcome: 'draw' });
    bus.emit('phase_committed', EVENT_SAMPLES.phase_committed);
    bus.emit('decision_spawned', EVENT_SAMPLES.decision_spawned);
    expect(a.played).toEqual(['key', 'key', 'key', 'victory', 'defeat', 'draw', 'phase', 'decision']);
  });

  it('plays the hatch only when larvae or workers go up', () => {
    const { bus, a } = bind({ workers: 5, larvae: 5 });
    bus.emit('larvae_changed', { larvae: 6 });
    bus.emit('workers_changed', { workers: 6 });
    bus.emit('larvae_changed', { larvae: 4 });
    bus.emit('workers_changed', { workers: 3 });
    bus.emit('workers_changed', { workers: 3 });
    expect(a.played).toEqual(['hatch', 'hatch']);
    bus.emit('workers_changed', { workers: 4 });
    expect(a.played).toEqual(['hatch', 'hatch', 'hatch']);
  });

  it('plays only for the events in SOUND_EVENTS', () => {
    const { bus, a } = bind({ workers: 1_000_000, larvae: 1_000_000 });
    const heard = new Set(SOUND_EVENTS.map((e) => e.event));
    for (const name of EVENT_NAMES.filter((n) => !heard.has(n))) bus.emit(name, EVENT_SAMPLES[name] as never);
    expect(a.played).toEqual([]);
  });

  it('every event that plays a sound lists the visual that carries the same news, and that hook exists in the UI', () => {
    const ui = listUiText();
    expect(SOUND_EVENTS.length).toBeGreaterThan(0);
    for (const { event, visual } of SOUND_EVENTS) {
      expect(visual.length, event).toBeGreaterThan(0);
      expect(ui.some((text) => text.includes(visual)), `${event}: ${visual}`).toBe(true);
    }
  });

  it('every cue the game defines is reachable from some event', () => {
    const { bus, a } = bind({ workers: 0, larvae: 0 });
    for (const { event, samples } of SOUND_EVENTS) for (const p of samples ?? [EVENT_SAMPLES[event]]) bus.emit(event, p as never);
    for (const cue of SOUND_CUES) expect(a.played, cue).toContain(cue);
  });

  it('stops after unbinding', () => {
    const { bus, a, unbind } = bind({ workers: 0, larvae: 0 });
    unbind();
    for (const name of EVENT_NAMES) bus.emit(name, EVENT_SAMPLES[name] as never);
    expect(a.played).toEqual([]);
  });
});

/** Every file under src/ui, as text (for the visual-twin check). */
function listUiText(): string[] {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/ui');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [readFileSync(join(dir, d.name), 'utf8')] : [],
    );
  return walk(root);
}
