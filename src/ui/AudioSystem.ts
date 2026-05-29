/**
 * AudioSystem — Web Audio API synthesized sound effects.
 *
 * No external audio files. All sounds are generated in real time
 * using oscillators, gain nodes, and noise buffers.
 *
 * AudioContext is created lazily on first user interaction to
 * comply with browser autoplay policies.
 */
export type SoundName = 'click' | 'prestige' | 'battle' | 'discovery' | 'error';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private _muted = false;

  /** Get or create the AudioContext (lazy, user-gesture gated). */
  private getContext(): AudioContext | null {
    if (this._muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        // Web Audio not available (SSR, jsdom, etc.)
        return null;
      }
    }
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /** Mute or unmute all sounds. */
  set muted(m: boolean) {
    this._muted = m;
  }

  get muted(): boolean {
    return this._muted;
  }

  /** Play a sound by name. */
  play(name: SoundName): void {
    switch (name) {
      case 'click': return this.playClick();
      case 'prestige': return this.playPrestige();
      case 'battle': return this.playBattle();
      case 'discovery': return this.playDiscovery();
      case 'error': return this.playError();
    }
  }

  // ── Individual sound generators ──────────────────────────────

  /** Short, crisp click — two quick sine blips. */
  playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First blip: short high sine
    this.playTone(ctx, 800, 0.08, 0.12, now);
    // Second blip: slightly lower, slightly delayed
    this.playTone(ctx, 600, 0.06, 0.10, now + 0.04);
  }

  /** Grand ascending arpeggio for prestige. */
  playPrestige(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
    freqs.forEach((freq, i) => {
      this.playTone(ctx, freq, 0.20, 0.15, now + i * 0.12);
    });
  }

  /** Martial drums + low rumble for battle. */
  playBattle(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Low rumble
    this.playTone(ctx, 80, 0.30, 0.18, now, 'sawtooth');
    // Two drum-like thumps
    this.playTone(ctx, 120, 0.15, 0.22, now + 0.05, 'triangle');
    this.playTone(ctx, 100, 0.12, 0.18, now + 0.20, 'triangle');
    // High metallic hit
    this.playNoise(ctx, 0.04, 0.10, now + 0.10);
  }

  /** Mystical chime for discovery. */
  playDiscovery(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Rising chime
    this.playTone(ctx, 440, 0.30, 0.10, now);
    this.playTone(ctx, 554, 0.25, 0.08, now + 0.12);
    this.playTone(ctx, 660, 0.20, 0.06, now + 0.24);
  }

  /** Buzzy error blip. */
  playError(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(ctx, 200, 0.20, 0.15, now, 'square');
    this.playTone(ctx, 150, 0.15, 0.10, now + 0.15, 'square');
  }

  // ── Synthesis primitives ─────────────────────────────────────

  /**
   * Play a single oscillator tone.
   *
   * @param ctx       AudioContext
   * @param freq      Frequency in Hz
   * @param duration  Seconds the oscillator runs
   * @param volume    Gain (0–1)
   * @param startTime ctx.currentTime offset
   * @param type      OscillatorNode type
   */
  private playTone(
    ctx: AudioContext,
    freq: number,
    duration: number,
    volume: number,
    startTime: number,
    type: OscillatorType = 'sine',
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    // Envelope: attack → sustain → release
    const attackEnd = startTime + Math.min(0.01, duration * 0.1);
    const releaseStart = startTime + duration * 0.7;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, attackEnd);
    gain.gain.setValueAtTime(volume, releaseStart);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /**
   * Play a short burst of white noise (for impacts).
   */
  private playNoise(
    ctx: AudioContext,
    duration: number,
    volume: number,
    startTime: number,
  ): void {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    // Bandpass filter for metallic quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(startTime);
    source.stop(startTime + duration + 0.01);
  }
}
