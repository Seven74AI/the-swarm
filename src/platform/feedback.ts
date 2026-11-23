/**
 * Platform feedback wiring (Story 1.10; sound, Story 8.8).
 *
 * Listeners only: they play feedback and never write game state (AR18).
 * A sound or a vibration is never the only channel: each moment also shows on screen.
 * main binds them once at boot.
 */
import type { EventBus } from '../engine/EventBus';
import type { SwarmEvents } from '../engine/events';
import type { BattleResult } from '../systems/BattleSystem';
import type { Audio, SoundCue } from './audio';
import type { Haptics } from './haptics';
import { GAME_FEEL, hapticFor } from './gameFeel';

/**
 * Play the game-feel table's haptics (`GAME_FEEL`, Story 8.9) for its events.
 * A press row vibrates at the press instead (`bindPressHaptics`). Returns an unbind.
 */
export function bindHapticFeedback(bus: EventBus, haptics: Haptics): () => void {
  const unbinds: Array<() => void> = [];
  for (const row of GAME_FEEL) {
    if (row.haptic === 'none' || row.press) continue;
    for (const event of row.events) {
      const fn = (payload: unknown) => {
        const pattern = hapticFor(row, payload);
        if (pattern) haptics.play(pattern);
      };
      bus.subscribe(event, fn as never);
      unbinds.push(() => bus.unsubscribe(event, fn as never));
    }
  }
  return () => {
    for (const u of unbinds.splice(0)) u();
  };
}

/** A button that takes the press haptic: a hold-repeat buy or assign (`Button` marks it). */
const PRESS_SELECTOR = '[data-feel="press"]:not([aria-disabled="true"])';

/**
 * "Light on press" for a buy (Story 8.9): one haptic at pointer-down on a
 * `[data-feel="press"]` button, so a hold vibrates once, not at every repeat.
 * The button's inverse state is the visual of the same press. Returns an unbind.
 */
export function bindPressHaptics(root: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>, haptics: Haptics): () => void {
  const pattern = GAME_FEEL.find((r) => r.press)?.haptic;
  const onDown = (e: Event) => {
    if (typeof pattern !== 'string' || pattern === 'none') return;
    if ((e as PointerEvent).button !== undefined && (e as PointerEvent).button !== 0) return;
    const target = e.target as Element | null;
    if (typeof target?.closest === 'function' && target.closest(PRESS_SELECTOR)) haptics.play(pattern);
  };
  root.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  return () => root.removeEventListener('pointerdown', onDown, { capture: true });
}

/**
 * Every event that plays a sound (Story 8.8, FR42, UX-DR37), with the on-screen
 * hook that carries the same news: audio is never the only channel
 * (EXPERIENCE.md → Accessibility). `samples` are payloads that reach each of the
 * event's cues (tests emit them). `tests/unit/platform/feedback.test.ts` checks
 * that each visual hook exists in src/ui.
 */
export interface SoundEvent {
  readonly event: keyof SwarmEvents;
  readonly cues: readonly SoundCue[];
  /** A hook (attribute or class) in src/ui that shows the same moment. */
  readonly visual: string;
  readonly samples?: readonly unknown[];
}

const BATTLE_SAMPLE = { victory: true, outcome: 'victory' } as const;

export const SOUND_EVENTS: readonly SoundEvent[] = Object.freeze([
  // A tap: the lay-egg `+N EGG` particle; a buy: the pressed button and its card's new level.
  { event: 'egg_clicked', cues: ['key'], visual: 'click-particle' },
  // A DIG press: the dirt puff at the dig face; a room breaking through: it arrives in the scene (Story 9.8).
  { event: 'dig_pressed', cues: ['crunch'], visual: 'data-dig-puff' },
  { event: 'room_opened', cues: ['breakthrough'], visual: 'data-arrive' },
  { event: 'upgrade_purchased', cues: ['key'], visual: 'data-pressed' },
  { event: 'building_complete', cues: ['key'], visual: 'data-pressed' },
  { event: 'mutation_purchased', cues: ['key'], visual: 'data-pressed' },
  { event: 'weapon_upgraded', cues: ['key'], visual: 'data-pressed' },
  { event: 'armor_upgraded', cues: ['key'], visual: 'data-pressed' },
  // A hatch or a maturing larva: the counts in the strip go up.
  { event: 'larvae_changed', cues: ['hatch'], visual: 'data-strip-cell', samples: [{ larvae: 1 }] },
  { event: 'workers_changed', cues: ['hatch'], visual: 'data-strip-cell', samples: [{ workers: 1 }] },
  // The battle summary sheet, its outcome on `data-outcome`.
  {
    event: 'battle_completed',
    cues: ['victory', 'defeat', 'draw'],
    visual: 'data-battle-summary',
    samples: [BATTLE_SAMPLE, { victory: false, outcome: 'defeat' }, { victory: false, outcome: 'draw' }],
  },
  // The phase reveal overlay.
  { event: 'phase_committed', cues: ['phase'], visual: 'phase-reveal' },
  // The decision sheet.
  { event: 'decision_spawned', cues: ['decision'], visual: 'data-decision' },
  // Chronicle lines.
  { event: 'prestige_triggered', cues: ['prestige'], visual: 'data-log-line' },
  { event: 'expedition_return', cues: ['discovery'], visual: 'data-log-line' },
  { event: 'exploration_return', cues: ['discovery'], visual: 'data-log-line' },
]);

const BATTLE_CUES: Readonly<Record<BattleResult['outcome'], SoundCue>> = Object.freeze({
  victory: 'victory',
  defeat: 'defeat',
  draw: 'draw',
});

/** The counts a hatch sound compares against: the state when the binding starts. */
export interface HatchCounts {
  readonly workers: number;
  readonly larvae: number;
}

/**
 * Play the juice-table sounds (Story 8.8). The `Audio` service decides whether
 * anything is heard (setting off, no gesture yet, no Web Audio) and applies the
 * rate limits. Returns an unbind.
 */
export function bindSoundFeedback(bus: EventBus, audio: Audio, start: HatchCounts): () => void {
  let { workers, larvae } = start;
  const unbinds: Array<() => void> = [];
  const on = <K extends keyof SwarmEvents>(event: K, fn: (p: SwarmEvents[K]) => void) => {
    bus.subscribe(event, fn);
    unbinds.push(() => bus.unsubscribe(event, fn));
  };
  const cue = (c: SoundCue) => () => audio.play(c);

  for (const { event, cues } of SOUND_EVENTS) {
    if (cues.length === 1 && cues[0] === 'key') on(event, cue('key'));
  }
  on('larvae_changed', (p) => {
    if (p.larvae > larvae) audio.play('hatch');
    larvae = p.larvae;
  });
  on('workers_changed', (p) => {
    if (p.workers > workers) audio.play('hatch');
    workers = p.workers;
  });
  on('battle_completed', (r) => audio.play(BATTLE_CUES[r.outcome] ?? (r.victory ? 'victory' : 'defeat')));
  on('phase_committed', cue('phase'));
  on('dig_pressed', cue('crunch'));
  on('room_opened', cue('breakthrough'));
  on('decision_spawned', cue('decision'));
  on('prestige_triggered', cue('prestige'));
  on('expedition_return', cue('discovery'));
  on('exploration_return', cue('discovery'));
  return () => {
    for (const u of unbinds.splice(0)) u();
  };
}
