import { FRAME_GAP_MS } from '../data/constants';

type TickCallback = (dtSec: number) => void;
type GapCallback = (gapMs: number) => void;

const TICK_MS = 50;

/**
 * Fixed-timestep 50ms game loop with delta-time accumulator.
 * Uses requestAnimationFrame for render-rate independence.
 * Game logic ticks at 20 Hz (50ms), render runs at rAF rate.
 *
 * A frame gap over FRAME_GAP_MS (a stall, or a throttled tab that never fired
 * `visibilitychange`) is not ticked through: it goes whole to the gap handler,
 * which main wires to the one resume path (Story 2.3, D1), where the offline
 * cap applies (Story 2.4). There is no frame cap: without a handler the gap
 * is simply not simulated.
 */
export class Ticker {
  private rafId: number | null = null;
  private callbacks: TickCallback[] = [];
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private _paused = false;
  private gapHandler: GapCallback | null = null;

  start(): void {
    if (this.running) return;
    this.running = true;
    this._paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    this._paused = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Pause the ticker without resetting the delta-time accumulator.
   * Callbacks stop firing immediately; resume() picks up where pause() left off.
   * Idempotent — calling pause() when already paused is a no-op.
   */
  pause(): void {
    if (!this.running) return;
    this.running = false;
    this._paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Resume from a paused state. Restarts the rAF loop WITHOUT resetting the
   * delta-time accumulator, so no game time is lost during the pause.
   * Idempotent — calling resume() when not paused is a no-op.
   */
  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Returns true when the ticker is explicitly paused (not just stopped or
   * not-yet-started). A stopped ticker that was never paused returns false.
   */
  isPaused(): boolean {
    return this._paused;
  }

  /** Pre-fill the accumulator (a test hook; offline time goes through resume, Story 2.3). */
  setAccumulator(ms: number): void {
    this.accumulator = ms;
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const raw = now - this.lastTime;
    this.lastTime = now;
    if (raw > FRAME_GAP_MS) {
      // The gap goes to resume(gap) (Story 2.3), never ticked frame by frame,
      // so no frame cap limits resumed time: the offline cap does (Story 2.4).
      this.gapHandler?.(raw);
      if (this.running) this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    this.accumulator += raw;

    while (this.accumulator >= TICK_MS) {
      this.tickOnce(TICK_MS / 1000); // pass delta in seconds
      this.accumulator -= TICK_MS;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private tickOnce(dtSec: number): void {
    for (const cb of this.callbacks) {
      cb(dtSec);
    }
  }

  /** Call `handler(gapMs)` for a frame gap over FRAME_GAP_MS instead of dropping it (Story 2.3). */
  onGap(handler: GapCallback): void {
    this.gapHandler = handler;
  }

  /** True while the rAF loop runs: after start() or resume(), before stop() or pause(). */
  isRunning(): boolean {
    return this.running;
  }

  onTick(callback: TickCallback): void {
    this.callbacks.push(callback);
  }

  offTick(callback: TickCallback): void {
    const idx = this.callbacks.indexOf(callback);
    if (idx !== -1) {
      this.callbacks.splice(idx, 1);
    }
  }
}
