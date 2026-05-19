import { EventBus } from './engine/EventBus';
import { Ticker } from './engine/Ticker';
import { GameLoop } from './engine/GameLoop';
import { StateManager } from './state/StateManager';
import { Store } from './state/Store';
import { ResourceSystem } from './systems/ResourceSystem';
import { UIRoot } from './ui/UIRoot';
import type { GameState } from './state/GameState';

/**
 * THE SWARM — Bootstrap
 *
 * Creates the core game engine, resource system, store, and UI.
 * ResourceSystem.tick is called every second by the Ticker.
 */
export function bootstrap(): {
  bus: EventBus;
  ticker: Ticker;
  manager: StateManager;
  loop: GameLoop;
  store: Store;
  resourceSystem: ResourceSystem;
  ui: UIRoot;
} {
  const bus = new EventBus();
  const ticker = new Ticker();
  const manager = new StateManager(bus);
  const store = new Store(manager);
  const resourceSystem = new ResourceSystem(bus);
  const loop = new GameLoop(bus, ticker, manager);

  // Wire resource ticking into the game loop
  ticker.onTick(() => {
    const state = manager.getState();
    const newState = resourceSystem.tick(state);
    manager.update(newState);
  });

  // Mount UI
  const app = document.getElementById('app');
  const ui = new UIRoot({
    bus,
    store,
    resourceSystem,
    getState: () => manager.getState(),
    setState: (state: GameState) => manager.update(state),
  });
  if (app) {
    ui.mount(app);
  }

  loop.start();

  return { bus, ticker, manager, loop, store, resourceSystem, ui };
}

// Auto-bootstrap when loaded in browser.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__swarm = bootstrap();
}
