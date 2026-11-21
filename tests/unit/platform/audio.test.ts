import { describe, expect, it } from 'vitest';
import {
  SOUND_CUES,
  SOUND_RATE_LIMITS,
  createWebAudio,
  noopAudio,
  type SoundCue,
  type WebAudioEnv,
} from '../../../src/platform/audio';
import { SOUNDS } from '../../../src/platform/audio/sounds';

/**
 * Story 8.8 (FR42, AR12): the Audio platform service. Off by default (the
 * setting is read at each call), no audio context before the first user
 * gesture, Web Audio only (so the device's silent switch applies where the
 * browser honours it), rate-limited hatch and key clicks, and a no-op where
 * audio is unavailable.
 */

interface Started {
  kind: 'osc' | 'noise';
  hz: number;
}

/** A tiny stand-in for AudioContext that records what was started. */
function fakeAudioContextClass(opts: { state?: string; resumeRejects?: boolean } = {}) {
  const contexts: FakeCtx[] = [];
  class FakeParam {
    value = 0;
    setValueAtTime() {
      return this;
    }
    linearRampToValueAtTime() {
      return this;
    }
    exponentialRampToValueAtTime() {
      return this;
    }
  }
  class FakeNode {
    connect(n: unknown) {
      return n;
    }
    disconnect() {}
  }
  class FakeCtx {
    state = opts.state ?? 'running';
    currentTime = 0;
    sampleRate = 8000;
    destination = new FakeNode();
    started: Started[] = [];
    resumes = 0;
    constructor() {
      contexts.push(this);
    }
    resume() {
      this.resumes += 1;
      if (opts.resumeRejects) return Promise.reject(new Error('not allowed'));
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      const started = this.started;
      const osc = Object.assign(new FakeNode(), {
        type: 'sine',
        frequency: new FakeParam(),
        start() {
          started.push({ kind: 'osc', hz: osc.frequency.value });
        },
        stop() {},
      });
      return osc;
    }
    createGain() {
      return Object.assign(new FakeNode(), { gain: new FakeParam() });
    }
    createBiquadFilter() {
      return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
    }
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(Math.max(1, Math.floor(length)));
      return { getChannelData: () => data };
    }
    createBufferSource() {
      const started = this.started;
      return Object.assign(new FakeNode(), {
        buffer: null as unknown,
        start() {
          started.push({ kind: 'noise', hz: 0 });
        },
        stop() {},
      });
    }
  }
  return { Ctor: FakeCtx, contexts };
}

/** A window stand-in: records gesture listeners so a test can fire them. */
function fakeEnv(extra: Partial<WebAudioEnv> = {}) {
  const fake = fakeAudioContextClass();
  const listeners = new Map<string, Array<() => void>>();
  const env: WebAudioEnv & { gesture(type?: string): void } = {
    AudioContext: fake.Ctor,
    addEventListener: (type: string, fn: () => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    gesture(type = 'pointerdown') {
      for (const fn of listeners.get(type) ?? []) fn();
    },
    ...extra,
  };
  return { env, contexts: fake.contexts, listeners };
}

function setup(opts: { on?: boolean; env?: Partial<WebAudioEnv> } = {}) {
  let on = opts.on ?? true;
  let t = 0;
  const { env, contexts, listeners } = fakeEnv(opts.env);
  const audio = createWebAudio({ env, enabled: () => on, now: () => t });
  return {
    audio,
    env,
    contexts,
    listeners,
    started: () => contexts.flatMap((c) => c.started),
    setOn: (v: boolean) => void (on = v),
    advance: (ms: number) => void (t += ms),
  };
}

describe('Audio platform service (Story 8.8)', () => {
  it('creates no audio context at boot or on a play before the first user gesture', () => {
    const s = setup({ on: true });
    for (const cue of SOUND_CUES) s.audio.play(cue);
    expect(s.contexts).toHaveLength(0);
  });

  it('creates no audio context on a gesture while sound is off (the default)', () => {
    const s = setup({ on: false });
    s.env.gesture('pointerdown');
    s.env.gesture('keydown');
    s.env.gesture('click');
    expect(s.contexts).toHaveLength(0);
    expect(s.audio.muted).toBe(true);
  });

  it('creates one context at the first gesture with sound on, and reuses it', () => {
    const s = setup({ on: true });
    s.env.gesture('pointerdown');
    s.env.gesture('keydown');
    s.env.gesture('pointerdown');
    expect(s.contexts).toHaveLength(1);
  });

  it('unlocks on the click that turns sound on (listened after the target acts)', () => {
    const s = setup({ on: false });
    s.env.gesture('pointerdown');
    s.setOn(true); // the SOUND ON button's handler runs between pointerdown and the bubbling click
    s.env.gesture('click');
    expect(s.contexts).toHaveLength(1);
  });

  it('plays nothing while sound is off, even with a context', () => {
    const s = setup({ on: true });
    s.env.gesture();
    s.setOn(false);
    for (const cue of SOUND_CUES) s.audio.play(cue);
    expect(s.started()).toEqual([]);
    expect(s.audio.muted).toBe(true);
  });

  it('every cue starts at least one synthesized voice once unlocked', () => {
    for (const cue of SOUND_CUES) {
      const s = setup({ on: true });
      s.env.gesture();
      s.audio.play(cue);
      expect(s.started().length, cue).toBeGreaterThan(0);
    }
  });

  it('the decision event is a two-tone chime', () => {
    const tones = new Set(SOUNDS.decision.filter((v) => !('noise' in v)).map((v) => ('hz' in v ? v.hz : 0)));
    expect(tones.size).toBe(2);
  });

  it('a win, a loss and a draw sound different', () => {
    const sig = (cue: SoundCue) => JSON.stringify(SOUNDS[cue]);
    expect(new Set([sig('victory'), sig('defeat'), sig('draw')]).size).toBe(3);
  });

  it('every cue is short and quiet: no voice runs past 1 s or above half volume', () => {
    for (const cue of SOUND_CUES) {
      for (const v of SOUNDS[cue]) {
        expect(v.startS + v.lengthS, cue).toBeLessThanOrEqual(1);
        expect(v.gain, cue).toBeLessThanOrEqual(0.5);
        expect(v.gain, cue).toBeGreaterThan(0);
      }
    }
  });

  it('the hatch is the softest sound', () => {
    const loudest = (cue: SoundCue) => Math.max(...SOUNDS[cue].map((v) => v.gain));
    for (const cue of SOUND_CUES.filter((c) => c !== 'hatch')) expect(loudest('hatch'), cue).toBeLessThanOrEqual(loudest(cue));
  });

  describe('rate limits (UX-DR37)', () => {
    const sounded = (cue: SoundCue, plays: number, everyMs: number) => {
      const s = setup({ on: true });
      s.env.gesture();
      const times: number[] = [];
      let t = 0;
      for (let i = 0; i < plays; i += 1) {
        const before = s.started().length;
        s.audio.play(cue);
        if (s.started().length > before) times.push(t);
        s.advance(everyMs);
        t += everyMs;
      }
      return times;
    };
    /** The most sounds in any 1 s window. */
    const peak = (times: number[]) => Math.max(0, ...times.map((a) => times.filter((b) => b >= a && b < a + 1000).length));

    it('limits hatch to 1 per second and key clicks to 8 per second', () => {
      expect(SOUND_RATE_LIMITS).toMatchObject({ hatch: 1, key: 8 });
      for (const cue of ['hatch', 'key'] as const) {
        const times = sounded(cue, 200, 10);
        expect(times.length, cue).toBeGreaterThan(1);
        expect(peak(times), cue).toBeLessThanOrEqual(SOUND_RATE_LIMITS[cue]!);
      }
    });

    it('a key click held at 8 per second still sounds every press', () => {
      const times = sounded('key', 40, 125);
      expect(times).toHaveLength(40);
    });

    it('a limited cue sounds again once the second has passed', () => {
      const s = setup({ on: true });
      s.env.gesture();
      s.audio.play('hatch');
      s.audio.play('hatch');
      const once = s.started().length;
      s.advance(1000);
      s.audio.play('hatch');
      expect(s.started().length).toBeGreaterThan(once);
    });

    it('a cue played while muted does not use up the limit', () => {
      const s = setup({ on: false });
      s.env.gesture();
      s.audio.play('hatch');
      s.setOn(true);
      s.env.gesture();
      s.audio.play('hatch');
      expect(s.started().length).toBeGreaterThan(0);
    });
  });

  describe('degrades, never crashes', () => {
    it('is a no-op where Web Audio is missing', () => {
      const s = setup({ on: true, env: { AudioContext: undefined } });
      expect(() => {
        s.env.gesture();
        for (const cue of SOUND_CUES) s.audio.play(cue);
      }).not.toThrow();
      expect(s.audio.available).toBe(false);
    });

    it('uses the prefixed webkitAudioContext on older Safari', () => {
      const fake = fakeAudioContextClass();
      const s = setup({ on: true, env: { AudioContext: undefined, webkitAudioContext: fake.Ctor } });
      s.env.gesture();
      s.audio.play('key');
      expect(fake.contexts).toHaveLength(1);
      expect(fake.contexts[0].started.length).toBeGreaterThan(0);
    });

    it('is a no-op when the constructor throws', () => {
      class Throws {
        constructor() {
          throw new Error('blocked');
        }
      }
      const s = setup({ on: true, env: { AudioContext: Throws } });
      expect(() => {
        s.env.gesture();
        s.audio.play('key');
      }).not.toThrow();
    });

    it('resumes a suspended context on a gesture and swallows a refused resume', async () => {
      const fake = fakeAudioContextClass({ state: 'suspended', resumeRejects: true });
      const s = setup({ on: true, env: { AudioContext: fake.Ctor } });
      expect(() => s.env.gesture()).not.toThrow();
      await Promise.resolve();
      expect(fake.contexts[0].resumes).toBeGreaterThan(0);
    });

    it('works without addEventListener (no gestures means silence)', () => {
      const s = setup({ on: true, env: { addEventListener: undefined } });
      expect(() => s.audio.play('key')).not.toThrow();
      expect(s.contexts).toHaveLength(0);
    });

    it('the no-op service never plays and reports itself muted and unavailable', () => {
      expect(() => noopAudio.play('decision')).not.toThrow();
      expect(noopAudio.muted).toBe(true);
      expect(noopAudio.available).toBe(false);
    });
  });

  it('asks for the ambient audio session where the browser has one, so the silent switch mutes it', () => {
    const session = { type: 'auto' };
    const s = setup({ on: true, env: { navigator: { audioSession: session } } });
    s.env.gesture();
    expect(session.type).toBe('ambient');
  });

  it('listens for gestures passively', () => {
    const calls: Array<[string, unknown]> = [];
    const { env } = fakeEnv();
    createWebAudio({
      env: { ...env, addEventListener: (type: string, _fn: () => void, options?: unknown) => void calls.push([type, options]) },
      enabled: () => true,
      now: () => 0,
    });
    expect(calls.map(([t]) => t)).toEqual(expect.arrayContaining(['pointerdown', 'keydown', 'click']));
    for (const [, o] of calls) expect(o).toMatchObject({ passive: true });
  });
});
