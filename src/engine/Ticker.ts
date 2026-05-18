type TickCallback = () => void;

/**
 * 1-second logic tick decoupled from rendering.
 * Uses setInterval internally. Use with fake timers for testing.
 */
export class Ticker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: TickCallback[] = [];

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      for (const cb of this.callbacks) {
        cb();
      }
    }, 1000);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onTick(callback: TickCallback): void {
    this.callbacks.push(callback);
  }
}
