type TickCallback = (dtSec: number) => void;

const TICK_MS = 50;

/**
 * Fixed-timestep 50ms game loop with delta-time accumulator.
 * Uses requestAnimationFrame for render-rate independence.
 * Game logic ticks at 20 Hz (50ms), render runs at rAF rate.
 *
 * Offline catch-up: if accumulator exceeds TICK_MS, multiple ticks
 * are simulated in a tight loop (capped at 1-second max frame delta).
 */
export class Ticker {
  private rafId: number | null = null;
  private callbacks: TickCallback[] = [];
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Public for offline catch-up: pre-fill accumulator with elapsed wall-clock time */
  setAccumulator(ms: number): void {
    this.accumulator = ms;
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min(now - this.lastTime, 1000); // cap at 1s to prevent spiral
    this.lastTime = now;
    this.accumulator += dt;

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
