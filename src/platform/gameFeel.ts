/**
 * The game-feel table (Story 8.9, FR41, UX-DR37), from EXPERIENCE.md → Game
 * Feel & Juice, as data: one row per trigger, with all three channels.
 *
 * - `visual`: what shows on screen, and the UI hooks that draw it. Every row
 *   has one, so a vibration or a sound is never the only feedback
 *   (`tests/unit/platform/gameFeel.test.ts` checks each hook exists in src/ui).
 * - `haptic`: a pattern, a win/loss pair, or `none`. The haptics service
 *   checks the haptics setting at every play.
 * - `sound`: the cues the row's events play (Story 8.8's `SOUND_EVENTS`), or
 *   `none`. Sound is off by default.
 * - `events`: what fires the row. `press` rows vibrate at pointer-down on a
 *   hold-repeat button (`[data-feel="press"]`), once per press, not once per repeat.
 *
 * `bindHapticFeedback` (feedback.ts) plays the haptics from this table. The
 * Transcendence ending's row is left to the ending (Epic 7): it needs a
 * "one long" pattern that no other moment uses.
 */
import type { SwarmEvents } from '../engine/events';
import type { SoundCue } from './audio';
import type { HapticPattern } from './haptics';

export const FEEL_TRIGGERS = [
  'lay-egg',
  'hatch',
  'newly-affordable',
  'press-buy',
  'battle-result',
  'decision',
  'phase-change',
  'camera-pull-back',
] as const;

export type FeelTrigger = (typeof FEEL_TRIGGERS)[number];

export type FeelHaptic = HapticPattern | 'none' | { readonly win: HapticPattern; readonly loss: HapticPattern };

export interface FeelRow {
  readonly trigger: FeelTrigger;
  readonly visual: { readonly description: string; readonly hooks: readonly string[] };
  readonly haptic: FeelHaptic;
  readonly sound: readonly SoundCue[] | 'none';
  readonly events: readonly (keyof SwarmEvents)[];
  /** The haptic plays at pointer-down on a `[data-feel="press"]` button, not on the events. */
  readonly press?: true;
}

const row = (r: FeelRow): FeelRow => Object.freeze(r);

export const GAME_FEEL: readonly FeelRow[] = Object.freeze([
  row({
    trigger: 'lay-egg',
    visual: { description: 'An egg appears beside the queen; +1 types in next to EGG', hooks: ['click-particle', 'data-arrive', 'data-type-in'] },
    haptic: 'light',
    sound: ['key'],
    events: ['egg_clicked'],
  }),
  row({
    trigger: 'hatch',
    visual: { description: 'Egg, then larva, then a worker that walks into a chamber', hooks: ['data-arrive'] },
    haptic: 'none',
    sound: ['hatch'],
    events: ['larvae_changed', 'workers_changed'],
  }),
  row({
    trigger: 'newly-affordable',
    visual: { description: 'The card border glows for 2 s; a dot on the tab', hooks: ['data-highlight', 'data-tab-dot'] },
    haptic: 'none',
    sound: 'none',
    events: [],
  }),
  row({
    trigger: 'press-buy',
    visual: {
      description: 'The button goes inverse until release; the value counts down; +N floats at most 8 a second',
      hooks: ['data-pressed', 'data-float'],
    },
    haptic: 'light',
    sound: ['key'],
    events: ['upgrade_purchased', 'building_complete', 'mutation_purchased', 'weapon_upgraded', 'armor_upgraded'],
    press: true,
  }),
  row({
    trigger: 'battle-result',
    visual: { description: 'The summary sheet; the headline types in', hooks: ['data-battle-summary', 'data-type-in'] },
    haptic: { win: 'medium', loss: 'double' },
    sound: ['victory', 'defeat', 'draw'],
    events: ['battle_completed'],
  }),
  row({
    trigger: 'decision',
    visual: { description: 'The sheet rises; the headline types in', hooks: ['data-decision', 'data-type-in'] },
    haptic: 'light',
    sound: ['decision'],
    events: ['decision_spawned'],
  }),
  row({
    trigger: 'phase-change',
    visual: { description: 'The palette cross-fades; the phase name; one line types in', hooks: ['phase-reveal', 'data-reveal-line'] },
    haptic: 'heavy',
    sound: ['phase'],
    events: ['phase_committed'],
  }),
  row({
    trigger: 'camera-pull-back',
    visual: { description: 'The scene eases out over 1 s', hooks: ['data-camera', '--camera-ms'] },
    haptic: 'none',
    sound: 'none',
    events: [],
  }),
]);

/** The pattern a row plays for one event's payload, or null for none. A draw is not a win. */
export function hapticFor(r: FeelRow, payload: unknown): HapticPattern | null {
  if (r.haptic === 'none') return null;
  if (typeof r.haptic === 'string') return r.haptic;
  const won = typeof payload === 'object' && payload !== null && (payload as { victory?: unknown }).victory === true;
  return won ? r.haptic.win : r.haptic.loss;
}
