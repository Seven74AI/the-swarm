/**
 * The sound recipes (Story 8.8, FR42, EXPERIENCE.md → Game Feel & Juice).
 *
 * Every sound is synthesized at play time from these voices: no audio files
 * (NFR11), so nothing to download, cache or license. Times are seconds from
 * the play call; gains are 0–1 before the master gain. They grew out of the
 * old `ui/AudioSystem.ts` (click, battle, discovery, prestige), which this
 * module replaces.
 */

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface Tone {
  readonly hz: number;
  readonly startS: number;
  readonly lengthS: number;
  readonly gain: number;
  readonly wave?: Wave;
}

/** A short burst of band-passed noise, for impacts. */
export interface Noise {
  readonly noise: true;
  readonly bandHz: number;
  readonly startS: number;
  readonly lengthS: number;
  readonly gain: number;
}

export type Voice = Tone | Noise;

/**
 * The cues the game plays. `key` = a tap (lay egg, a buy), `hatch` = an egg
 * hatches or a larva matures, `victory`/`defeat`/`draw` = a battle result,
 * `phase` = CONTINUE entered a phase, `decision` = a decision event opened.
 * `prestige` and `discovery` (an expedition, exploration or ship returns) are
 * kept from the old AudioSystem.
 */
export type SoundCue = 'key' | 'crunch' | 'breakthrough' | 'hatch' | 'victory' | 'defeat' | 'draw' | 'phase' | 'decision' | 'prestige' | 'discovery';

export const SOUND_CUES: readonly SoundCue[] = Object.freeze([
  'key',
  'crunch',
  'breakthrough',
  'hatch',
  'victory',
  'defeat',
  'draw',
  'phase',
  'decision',
  'prestige',
  'discovery',
]);

const tone = (hz: number, startS: number, lengthS: number, gain: number, wave?: Wave): Tone =>
  Object.freeze(wave ? { hz, startS, lengthS, gain, wave } : { hz, startS, lengthS, gain });
const noise = (bandHz: number, startS: number, lengthS: number, gain: number): Noise =>
  Object.freeze({ noise: true as const, bandHz, startS, lengthS, gain });

export const SOUNDS: Readonly<Record<SoundCue, readonly Voice[]>> = Object.freeze({
  // A soft terminal key click: a tick of noise over a short high blip.
  key: Object.freeze([noise(3200, 0, 0.012, 0.06), tone(1400, 0, 0.025, 0.04, 'triangle')]),
  // A DIG press (Story 9.8): a short, low crunch of noise, a dull knock under it.
  crunch: Object.freeze([noise(700, 0, 0.05, 0.08), noise(1800, 0.01, 0.025, 0.04), tone(110, 0, 0.04, 0.05, 'triangle')]),
  // A room breaking through (Story 9.8): a thump, falling dirt, then an open, rising fifth.
  breakthrough: Object.freeze([tone(82, 0, 0.18, 0.14), noise(900, 0.02, 0.22, 0.06), tone(262, 0.12, 0.22, 0.07, 'triangle'), tone(392, 0.2, 0.3, 0.06, 'triangle')]),
  // Very soft, at most once a second: a low, round bubble.
  hatch: Object.freeze([tone(330, 0, 0.09, 0.03), tone(440, 0.05, 0.08, 0.02)]),
  // Result tones: up for a win, down for a loss, level for a draw.
  victory: Object.freeze([tone(392, 0, 0.12, 0.12, 'triangle'), tone(523, 0.1, 0.12, 0.12, 'triangle'), tone(659, 0.2, 0.22, 0.12, 'triangle')]),
  defeat: Object.freeze([tone(330, 0, 0.16, 0.12, 'triangle'), tone(247, 0.14, 0.3, 0.12, 'triangle'), noise(400, 0, 0.05, 0.05)]),
  draw: Object.freeze([tone(392, 0, 0.14, 0.1, 'triangle'), tone(392, 0.18, 0.18, 0.08, 'triangle')]),
  // The phase tone: a low fifth under the palette cross-fade.
  phase: Object.freeze([tone(131, 0, 0.8, 0.12), tone(196, 0.08, 0.72, 0.08), tone(262, 0.16, 0.64, 0.05)]),
  // Two-tone chime: high then low.
  decision: Object.freeze([tone(880, 0, 0.18, 0.1), tone(660, 0.16, 0.26, 0.1)]),
  prestige: Object.freeze([tone(523, 0, 0.2, 0.15), tone(659, 0.12, 0.2, 0.15), tone(784, 0.24, 0.2, 0.15), tone(1047, 0.36, 0.3, 0.15)]),
  discovery: Object.freeze([tone(440, 0, 0.3, 0.1), tone(554, 0.12, 0.25, 0.08), tone(660, 0.24, 0.2, 0.06)]),
});

/**
 * At most this many of a cue in any 1 s (UX-DR37): hatches can come many to a
 * tick and a held button repeats up to 8 times a second.
 */
export const SOUND_RATE_LIMITS: Readonly<Partial<Record<SoundCue, number>>> = Object.freeze({ hatch: 1, key: 8, crunch: 8, breakthrough: 2 });

/** The window the limits count over. */
export const SOUND_RATE_WINDOW_MS = 1000;
