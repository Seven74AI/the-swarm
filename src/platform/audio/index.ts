/**
 * Audio (Story 8.8, FR42, AR12, D9): the platform service that plays the
 * game's synthesized sound effects.
 *
 * - Off by default: the sound setting is read at every call, so turning it off
 *   silences the next cue at once.
 * - No audio context before the first user gesture (browser autoplay rules):
 *   gestures are listened for on the window, and the context is made at the
 *   first one while sound is on. `click`/`keyup` are listened to after the
 *   target acts, so the tap that turns sound ON also unlocks it.
 * - Web Audio only, never media elements, and the ambient audio session where
 *   the browser has one, so the device's silent switch mutes it where the
 *   browser honours that.
 * - A no-op where audio is missing or refused; it never throws.
 * - `hatch` and `key` are rate-limited (`SOUND_RATE_LIMITS`).
 *
 * Audio is never the only channel: every cue's event also shows on screen
 * (`SOUND_EVENTS` in feedback.ts lists the visual for each).
 */
import { SOUNDS, SOUND_RATE_LIMITS, SOUND_RATE_WINDOW_MS, type SoundCue } from './sounds';
import { playVoices, type SynthContext } from './synth';

export { SOUND_CUES, SOUND_RATE_LIMITS, type SoundCue } from './sounds';

export interface Audio {
  /** True while the sound setting is off (or audio can't play): `play` does nothing. */
  readonly muted: boolean;
  /** This device has Web Audio. */
  readonly available: boolean;
  play(cue: SoundCue): void;
}

export const noopAudio: Audio = Object.freeze({ muted: true, available: false, play: () => {} });

type ContextCtor = new () => AudioContext;
type GestureListener = (type: string, listener: () => void, options?: AddEventListenerOptions) => void;

/** The parts of `window` the service reads; a plain object in tests. */
export interface WebAudioEnv {
  readonly AudioContext?: unknown;
  /** Safari before 14.1. */
  readonly webkitAudioContext?: unknown;
  /** Safari 16.4+: `type = 'ambient'` keeps the silent switch in charge. */
  readonly navigator?: { readonly audioSession?: { type?: string } };
  readonly addEventListener?: GestureListener;
}

export interface WebAudioDeps {
  readonly env: WebAudioEnv;
  /** The sound setting, read at each call. */
  readonly enabled: () => boolean;
  /** A clock in ms for the rate limits (default `performance.now`). */
  readonly now?: () => number;
}

/** Gestures that unlock audio, and whether to listen while capturing (before the target acts). */
const GESTURES: readonly (readonly [string, boolean])[] = [
  ['pointerdown', true],
  ['keydown', true],
  ['click', false],
  ['keyup', false],
];

/** Overall volume, under the per-voice gains. */
const MASTER_GAIN = 0.8;

function ctorOf(env: WebAudioEnv): ContextCtor | null {
  try {
    const c = env.AudioContext ?? env.webkitAudioContext;
    return typeof c === 'function' ? (c as ContextCtor) : null;
  } catch {
    return null;
  }
}

function preferAmbientSession(env: WebAudioEnv): void {
  try {
    const session = env.navigator?.audioSession;
    if (session) session.type = 'ambient';
  } catch {
    // Not supported or refused: the browser's default session applies.
  }
}

export function createWebAudio({ env, enabled, now = () => performance.now() }: WebAudioDeps): Audio {
  const Ctor = ctorOf(env);
  let ctx: AudioContext | null = null;
  let out: AudioNode | null = null;
  let failed = false;
  const recent = new Map<SoundCue, number[]>();

  const isOn = (): boolean => {
    try {
      return enabled();
    } catch {
      return false;
    }
  };

  /** Make (or wake) the context; only ever called from a user gesture. */
  const unlock = (): void => {
    if (!Ctor || failed || !isOn()) return;
    try {
      if (!ctx) {
        preferAmbientSession(env);
        ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
        out = master;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      failed = true;
      ctx = null;
      out = null;
    }
  };

  if (Ctor) {
    try {
      for (const [type, capture] of GESTURES) env.addEventListener?.(type, unlock, { capture, passive: true });
    } catch {
      // No gestures means no context: silent, never broken.
    }
  }

  /** Under the cue's limit for the last window; records the play if so. */
  const admit = (cue: SoundCue): boolean => {
    const limit = SOUND_RATE_LIMITS[cue];
    if (limit === undefined) return true;
    const t = now();
    const times = (recent.get(cue) ?? []).filter((at) => at > t - SOUND_RATE_WINDOW_MS);
    if (times.length >= limit) {
      recent.set(cue, times);
      return false;
    }
    recent.set(cue, [...times, t]);
    return true;
  };

  return {
    get muted() {
      return !Ctor || !isOn();
    },
    available: Ctor !== null,
    play(cue) {
      if (!ctx || !out || !isOn() || ctx.state === 'closed') return;
      if (!admit(cue)) return;
      playVoices(ctx as SynthContext, out, SOUNDS[cue]);
    },
  };
}
