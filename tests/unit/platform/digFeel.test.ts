/**
 * Story 9.8 (UX-DR49, UX-DR37, FR41): each DIG press crunches; a room breaking
 * through lands with a sound and a haptic (where vibrate works).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/engine/EventBus';
import { bindHapticFeedback, bindSoundFeedback, SOUND_EVENTS } from '../../../src/platform/feedback';
import { SOUND_RATE_LIMITS, type Audio, type SoundCue } from '../../../src/platform/audio';
import type { HapticPattern, Haptics } from '../../../src/platform/haptics';
import { GAME_FEEL } from '../../../src/platform/gameFeel';
import { roomCost } from '../../../src/systems/Dig';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { diggerPointsPerSec } from '../../../src/systems/Dig';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';
import { testActions } from '../helpers/actions';
import { gameState } from '../../../src/state/gameSignal';

const initial = gameState.value;
afterEach(() => {
  gameState.value = initial;
});

const colony = (progress = 0, dig = 0) =>
  makeState({ phase: Phase.COLONY, resources: { workers: Math.max(1, dig) }, workersAssigned: { dig }, dig: { roomsDug: 0, progress, carry: 0, roomsByHand: 0, auto: false } });

describe('dig events', () => {
  it('a press raises dig_pressed after its write; one that opens a room also raises room_opened', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.subscribe('dig_pressed', () => seen.push('dig'));
    bus.subscribe('room_opened', (p) => seen.push(`room ${p.roomsDug}`));
    const actions = testActions(bus);
    gameState.value = colony(0);
    actions.dig();
    expect(seen).toEqual(['dig']);
    gameState.value = colony(roomCost(0) - 1);
    actions.dig();
    expect(seen).toEqual(['dig', 'dig', 'room 1']);
  });

  it('a refused press raises nothing', () => {
    const bus = new EventBus();
    let n = 0;
    bus.subscribe('dig_pressed', () => n++);
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    testActions(bus).dig();
    expect(n).toBe(0);
  });

  it('diggers opening a room on their own raise room_opened too', () => {
    const bus = new EventBus();
    const rooms: number[] = [];
    bus.subscribe('room_opened', (p) => rooms.push(p.roomsDug));
    const s = colony(0, 20);
    new ResourceSystem(bus).tick(s, undefined, Math.ceil(roomCost(0) / diggerPointsPerSec(s)) + 1);
    expect(rooms.length).toBeGreaterThan(0);
  });
});

describe('dig feel', () => {
  function audio(): Audio & { played: SoundCue[] } {
    const played: SoundCue[] = [];
    return { played, play: (c: SoundCue) => void played.push(c), unlock: () => {}, available: () => true } as unknown as Audio & { played: SoundCue[] };
  }
  const recorder = (): Haptics & { played: HapticPattern[] } => {
    const played: HapticPattern[] = [];
    return { played, play: (p) => void played.push(p) };
  };

  it('a press crunches; a breakthrough plays its own sound', () => {
    const bus = new EventBus();
    const a = audio();
    bindSoundFeedback(bus, a, { workers: 0, larvae: 0 });
    bus.emit('dig_pressed', {});
    bus.emit('room_opened', { roomsDug: 1 });
    expect(a.played).toEqual(['crunch', 'breakthrough']);
  });

  it('the crunch is rate-limited like key clicks', () => {
    expect(SOUND_RATE_LIMITS.crunch).toBeDefined();
    expect(SOUND_RATE_LIMITS.crunch).toBeLessThanOrEqual(SOUND_RATE_LIMITS.key!);
  });

  it('a breakthrough vibrates; a plain press does not', () => {
    const bus = new EventBus();
    const h = recorder();
    bindHapticFeedback(bus, h);
    bus.emit('dig_pressed', {});
    expect(h.played).toEqual([]);
    bus.emit('room_opened', { roomsDug: 1 });
    expect(h.played).toHaveLength(1);
  });

  it('the feel table lists both moments, each with an on-screen hook', () => {
    const dig = GAME_FEEL.find((r) => r.trigger === 'dig')!;
    const room = GAME_FEEL.find((r) => r.trigger === 'room-open')!;
    expect(dig.events).toContain('dig_pressed');
    expect(dig.sound).toContain('crunch');
    expect(room.events).toContain('room_opened');
    expect(room.sound).toContain('breakthrough');
    expect(room.haptic).not.toBe('none');
    expect(SOUND_EVENTS.map((e) => e.event)).toEqual(expect.arrayContaining(['dig_pressed', 'room_opened']));
  });
});
