import type { Ticker } from './Ticker';
import type { GameState } from '../state/GameState';
import { productionMultiplierFor, workerEfficiency } from './ProgressionCurve';
import { createTickContext, type TickContext } from './TickContext';
import type { EventQueue } from './events';
import { log } from '../utils/log';

/** Consecutive failed ticks after which the simulation stops (Story 1.17, AR16). */
export const MAX_FAILED_TICKS = 3;

/**
 * How one tick reads, computes, writes and flushes (Story 1.17).
 * `step` computes the next state from the current one and may raise events on
 * `ctx.events`; it must not write state itself. The boundary writes the result
 * once, then flushes the queued events.
 */
export interface TickBinding {
  read: () => GameState;
  step: (state: GameState, ctx: TickContext) => GameState;
  write: (state: GameState) => void;
  flush: (events: EventQueue) => void;
  /** Called once, after MAX_FAILED_TICKS consecutive failures stop the simulation. */
  onHalt: (error: unknown) => void;
}

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
  private failures = 0;
  private halted = false;

  constructor(ticker: Ticker) {
    this.ticker = ticker;
  }

  start(): void {
    if (this.halted) return;
    this.ticker.start();
  }

  stop(): void {
    this.ticker.stop();
  }

  pause(): void {
    this.ticker.pause();
  }

  resume(): void {
    if (this.halted) return;
    this.ticker.resume();
  }

  /** True while the ticker runs (not stopped, paused, halted or not yet started). */
  isRunning(): boolean {
    return this.ticker.isRunning();
  }

  /** True once MAX_FAILED_TICKS consecutive ticks have failed; start/resume do nothing then. */
  isHalted(): boolean {
    return this.halted;
  }

  /**
   * The tick boundary (Story 1.17, AR16). Registers a guarded tick on the
   * ticker and returns it (tests and bootstrap() call it directly).
   *
   * A tick that throws is discarded whole: nothing is written (the state
   * reference stays the last good snapshot), its queued events are dropped, and
   * the error goes to `log.error`. The next tick runs normally. After
   * MAX_FAILED_TICKS failures in a row the ticker stops and `onHalt` runs once.
   * A tick that returns the state it was given writes nothing.
   */
  bindTick(binding: TickBinding): (dtSec: number) => void {
    const tick = (dtSec: number): void => {
      if (this.halted) return;
      const prev = binding.read();
      const ctx = createTickContext(dtSec, prev.rng);
      let next: GameState;
      try {
        next = binding.step(prev, ctx);
      } catch (error) {
        ctx.events.clear();
        this.failures += 1;
        log.error('tick', `tick failed; state kept (${this.failures}/${MAX_FAILED_TICKS})`, error);
        if (this.failures >= MAX_FAILED_TICKS) this.halt(error, binding);
        return;
      }
      this.failures = 0;
      if (next !== prev) binding.write(next);
      binding.flush(ctx.events);
    };
    this.ticker.onTick(tick);
    return tick;
  }

  private halt(error: unknown, binding: TickBinding): void {
    this.halted = true;
    this.ticker.stop();
    log.error('tick', `${MAX_FAILED_TICKS} ticks failed in a row; simulation stopped`);
    binding.onHalt(error);
  }

  isPaused(): boolean {
    return this.ticker.isPaused();
  }

  /**
   * Get the current production multiplier for the given game state.
   * Combines phase progression and every Legacy Point ever earned (Story 5.2);
   * the same multiplier ResourceSystem scales production by.
   */
  getProductionMultiplier(state: GameState): number {
    return productionMultiplierFor(state);
  }

  /**
   * Get the current worker efficiency for the given game state.
   * Applies diminishing returns above 500 workers.
   */
  getWorkerEfficiency(state: GameState): number {
    return workerEfficiency(state.resources.workers);
  }
}
