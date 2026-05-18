import type { EventBus } from './EventBus';
import type { Ticker } from './Ticker';
import type { StateManager } from '../state/StateManager';
import type { GameState } from '../state/GameState';

type RenderCallback = (state: GameState) => void;

/**
 * Coordinates: Ticker → StateManager.update → UI render.
 * Boot sequence: load state (if saved) → start ticker → mount UI.
 */
export class GameLoop {
  private bus: EventBus;
  private ticker: Ticker;
  private manager: StateManager;
  private renderCallbacks: RenderCallback[] = [];

  constructor(bus: EventBus, ticker: Ticker, manager: StateManager) {
    this.bus = bus;
    this.ticker = ticker;
    this.manager = manager;

    this.ticker.onTick(() => this.tick());
  }

  start(): void {
    this.ticker.start();
  }

  stop(): void {
    this.ticker.stop();
  }

  onRender(callback: RenderCallback): void {
    this.renderCallbacks.push(callback);
  }

  private tick(): void {
    // Advance game time
    const state = this.manager.getState();
    this.manager.update({
      stats: { ...state.stats, playTimeMs: state.stats.playTimeMs + 1000 },
    });

    // Notify render callbacks with current state
    const updated = this.manager.getState();
    for (const cb of this.renderCallbacks) {
      cb(updated);
    }
  }
}
