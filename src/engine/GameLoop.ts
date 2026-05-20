import type { Ticker } from './Ticker';

/**
 * Coordinates: Ticker lifecycle.
 * The main tick logic (systems + playTimeMs advancement) lives in main.ts
 * to avoid double StateManager.update() per tick.
 */
export class GameLoop {
  private ticker: Ticker;

  constructor(ticker: Ticker) {
    this.ticker = ticker;
  }

  start(): void {
    this.ticker.start();
  }

  stop(): void {
    this.ticker.stop();
  }
}
