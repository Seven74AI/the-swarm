import type { Ticker } from './Ticker';
import type { GameState } from '../state/GameState';
import { productionMultiplier, workerEfficiency } from './ProgressionCurve';

/**
 * Coordinates: Ticker lifecycle.
 * The main tick logic (systems + playTimeMs advancement) lives in main.ts
 * to avoid double StateManager.update() per tick.
 *
 * Progression pacing: provides production multiplier based on phase
 * and legacy points for per-tick resource scaling.
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

  /** Pre-fill accumulator for offline catch-up (in milliseconds, capped at 8h) */
  setOfflineAccumulator(ms: number): void {
    this.ticker.setAccumulator(Math.min(ms, 8 * 60 * 60 * 1000));
  }

  /**
   * Get the current production multiplier for the given game state.
   * Combines phase progression (×1.12 per phase) and legacy point bonuses (+50% per LP).
   * Used by ResourceSystem.tick() to scale resource production each tick.
   */
  getProductionMultiplier(state: GameState): number {
    return productionMultiplier(state.phase, state.prestige.legacyPoints);
  }

  /**
   * Get the current worker efficiency for the given game state.
   * Applies diminishing returns above 500 workers.
   */
  getWorkerEfficiency(state: GameState): number {
    return workerEfficiency(state.resources.workers);
  }
}
