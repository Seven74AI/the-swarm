import { EventBus } from './engine/EventBus';
import { Ticker } from './engine/Ticker';
import { GameLoop } from './engine/GameLoop';
import { StateManager } from './state/StateManager';

/**
 * THE SWARM — Bootstrap
 *
 * Creates the core game engine and starts the game loop.
 * UI is mounted separately by the render system.
 */
export function bootstrap(): {
  bus: EventBus;
  ticker: Ticker;
  manager: StateManager;
  loop: GameLoop;
} {
  const bus = new EventBus();
  const ticker = new Ticker();
  const manager = new StateManager(bus);
  const loop = new GameLoop(bus, ticker, manager);

  loop.start();

  return { bus, ticker, manager, loop };
}

// Auto-bootstrap when loaded in browser.
// The return value is stored on window so that later code (devtools, save/load)
// can access the core systems without importing modules.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__swarm = bootstrap();
}
