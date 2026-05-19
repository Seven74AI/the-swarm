import { EventBus } from './engine/EventBus';
import { Ticker } from './engine/Ticker';
import { GameLoop } from './engine/GameLoop';
import { StateManager } from './state/StateManager';
import { Store } from './state/Store';
import { ResourceSystem } from './systems/ResourceSystem';
import { SoldierSystem } from './systems/SoldierSystem';
import { tickExpeditions, resolveExpedition } from './systems/ExpeditionSystem';
import { UIRoot } from './ui/UIRoot';
import { SaveManager } from './persistence/SaveManager';
import { PhaseStateMachine } from './phases/PhaseStateMachine';
import { Phase, PHASE_ORDER } from './phases/phases';
import { PhaseContent } from './phases/PhaseContent';
import { TRANSITIONS } from './phases/transitions';
import type { GameState } from './state/GameState';

/**
 * THE SWARM — Bootstrap
 *
 * Full game loop with persistence, phase state machine, and autosave.
 * - Load saved state on startup (or start fresh)
 * - Each tick: ResourceSystem.tick → PhaseStateMachine.tick → StateManager.update
 * - Autosave every 30 seconds
 * - PhaseContent manages which panels are active
 */
export function bootstrap(): {
  bus: EventBus;
  ticker: Ticker;
  manager: StateManager;
  loop: GameLoop;
  store: Store;
  resourceSystem: ResourceSystem;
  saveManager: SaveManager;
  fsm: PhaseStateMachine;
  ui: UIRoot;
} {
  const bus = new EventBus();
  const ticker = new Ticker();
  const manager = new StateManager(bus);
  const store = new Store(manager);
  const resourceSystem = new ResourceSystem(bus);
  const soldierSystem = new SoldierSystem(bus);
  const saveManager = new SaveManager();
  const loop = new GameLoop(bus, ticker, manager);
  const phaseContent = new PhaseContent();

  // Try to load saved state
  const saved = saveManager.load();
  if (saved) {
    manager.update(saved.gameState as Partial<GameState>);
  }

  // Initialize PhaseStateMachine from current state
  const currentPhase = (manager.getState().phase as Phase) ?? Phase.EGG_LAYING;
  const fsm = new PhaseStateMachine(currentPhase, TRANSITIONS);

  // Wire resource ticking into the game loop
  ticker.onTick(() => {
    const state = manager.getState();
    let newState = resourceSystem.tick(state);
    newState = soldierSystem.tick(newState);

    // Expedition system: tick timers and resolve completed ones
    newState = tickExpeditions(newState);
    for (const exp of newState.expeditions) {
      if (exp.ticksRemaining <= 0) {
        newState = resolveExpedition(newState, exp);
      }
    }

    manager.update(newState);

    // Check phase transitions
    const updated = manager.getState();
    const newPhase = fsm.tick(updated, bus);
    if (newPhase !== updated.phase) {
      manager.update({ phase: newPhase } as Partial<GameState>);
    }
  });

  // Mount UI
  const app = document.getElementById('app');
  const ui = new UIRoot({
    bus,
    store,
    resourceSystem,
    soldierSystem,
    saveManager,
    getState: () => manager.getState(),
    setState: (state: GameState) => manager.update(state),
  });
  if (app) {
    ui.mount(app);
  }

  // Reveal panels for current phase
  phaseContent.onPhaseEnter(currentPhase as Phase, ui);

  // Listen for phase changes to reveal new panels
  bus.subscribe('phase_changed', (payload: unknown) => {
    const phase = (payload as { phase: string }).phase as Phase;
    phaseContent.onPhaseEnter(phase, ui);
  });

  // Start autosave
  saveManager.startAutosave(() => ({
    state: manager.getState(),
    playTimeMs: manager.getState().stats.playTimeMs,
  }));

  // Save on beforeunload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      const state = manager.getState();
      saveManager.save(state, state.stats.playTimeMs);
    });
  }

  loop.start();

  return { bus, ticker, manager, loop, store, resourceSystem, saveManager, fsm, ui };
}

// Auto-bootstrap when loaded in browser.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__swarm = bootstrap();
}
