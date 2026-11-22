/**
 * Plays a recipe on a Web Audio context (Story 8.8). Oscillators and a noise
 * buffer through gain envelopes, into one master gain. Never throws: a node
 * the browser refuses just drops that voice.
 */
import type { Noise, Tone, Voice } from './sounds';

/** The parts of `AudioContext` the synth uses. */
export type SynthContext = Pick<
  AudioContext,
  'currentTime' | 'sampleRate' | 'createOscillator' | 'createGain' | 'createBuffer' | 'createBufferSource' | 'createBiquadFilter'
>;

/** Attack time, s, and when the release starts, as a share of the voice. */
const ATTACK_S = 0.005;
const RELEASE_AT = 0.6;
/** Past the envelope's end, so a node never clicks off at full gain. */
const STOP_PAD_S = 0.02;

function envelope(ctx: SynthContext, out: AudioNode, at: number, v: Voice): GainNode {
  const gain = ctx.createGain();
  const end = at + v.lengthS;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(v.gain, at + Math.min(ATTACK_S, v.lengthS / 2));
  gain.gain.setValueAtTime(v.gain, at + v.lengthS * RELEASE_AT);
  gain.gain.linearRampToValueAtTime(0, end);
  gain.connect(out);
  return gain;
}

function playTone(ctx: SynthContext, out: AudioNode, at: number, v: Tone): void {
  const osc = ctx.createOscillator();
  osc.type = v.wave ?? 'sine';
  osc.frequency.value = v.hz;
  osc.connect(envelope(ctx, out, at, v));
  osc.start(at);
  osc.stop(at + v.lengthS + STOP_PAD_S);
}

function playNoise(ctx: SynthContext, out: AudioNode, at: number, v: Noise): void {
  const length = Math.max(1, Math.floor(ctx.sampleRate * v.lengthS));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = v.bandHz;
  filter.Q.value = 0.7;
  source.connect(filter);
  filter.connect(envelope(ctx, out, at, v));
  source.start(at);
  source.stop(at + v.lengthS + STOP_PAD_S);
}

export function playVoices(ctx: SynthContext, out: AudioNode, voices: readonly Voice[]): void {
  const now = ctx.currentTime;
  for (const v of voices) {
    try {
      if ('noise' in v) playNoise(ctx, out, now + v.startS, v);
      else playTone(ctx, out, now + v.startS, v);
    } catch {
      // A refused node drops its voice; sound must never break the game.
    }
  }
}
