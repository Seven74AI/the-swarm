import { EventBus } from './engine/EventBus';
import { Ticker } from './engine/Ticker';
import { GameLoop } from './engine/GameLoop';
import { gameState } from './state/gameSignal';
import { ResourceSystem } from './systems/ResourceSystem';
import { SoldierSystem } from './systems/SoldierSystem';
import { BattleSystem } from './systems/BattleSystem';
import { MapSystem } from './systems/MapSystem';
import { TerritorySystem } from './systems/TerritorySystem';
import { DecisionSystem } from './systems/DecisionSystem';
import { tickExpeditions, resolveExpedition } from './systems/ExpeditionSystem';
import { tickExplorations, resolveExploration } from './systems/ExplorationSystem';
import {
  tickMissions,
  resolveMission,
} from './systems/SpaceshipSystem';
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
 * Uses @preact/signals-core for reactive state (replaces StateManager + Store).
 * - Load saved state on startup (or start fresh)
 * - Each tick: ResourceSystem.tick → PhaseStateMachine.tick → write signal
 * - Autosave every 30 seconds
 * - PhaseContent manages which panels are active
 * - Fixed 50ms timestep with rAF-based delta accumulator
 * - Offline progress: accelerated catch-up on load (capped at 8 hours)
 */
export function bootstrap(): {
  bus: EventBus;
  ticker: Ticker;
  loop: GameLoop;
  resourceSystem: ResourceSystem;
  saveManager: SaveManager;
  fsm: PhaseStateMachine;
  ui: UIRoot;
  decisionSystem: DecisionSystem;
} {
  const bus = new EventBus();
  const ticker = new Ticker();
  const resourceSystem = new ResourceSystem(bus);
  const soldierSystem = new SoldierSystem(bus);
  const battleSystem = new BattleSystem(bus);
  const decisionSystem = new DecisionSystem(bus);
  const saveManager = new SaveManager();
  const loop = new GameLoop(ticker);
  const phaseContent = new PhaseContent();
  const mapSystem = new MapSystem();
  const territorySystem = new TerritorySystem();

  // Try to load saved state
  const saved = saveManager.load();
  let offlineMessage: string | null = null;

  if (saved) {
    gameState.value = saved.gameState;

    // #20 Offline progress: compute elapsed wall-clock time and run catch-up
    const saveTimestamp = saved.gameState.lastSaveTimestamp || saved.timestamp || 0;
    const now = Date.now();
    const offlineMs = now - saveTimestamp;

    if (offlineMs > 1000 && saveTimestamp > 0) {
      const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // 8 hours
      const cappedMs = Math.min(offlineMs, OFFLINE_CAP_MS);

      // Run accelerated catch-up: simulate ticks for the elapsed time
      const dtSec = 50 / 1000; // 50ms per tick
      const totalTicks = Math.floor(cappedMs / 50);
      let catchUpState = gameState.value;

      for (let i = 0; i < totalTicks; i++) {
        catchUpState = processTick(catchUpState, resourceSystem, soldierSystem, mapSystem, territorySystem, bus, dtSec);
      }

      gameState.value = catchUpState;

      const hoursOffline = Math.round((offlineMs / (1000 * 60 * 60)) * 10) / 10;
      if (hoursOffline >= 0.1) {
        offlineMessage = `Welcome back! ${hoursOffline} hour${hoursOffline === 1 ? '' : 's'} of progress simulated.`;
      } else {
        const minsOffline = Math.round(offlineMs / (1000 * 60));
        offlineMessage = `Welcome back! ${minsOffline} minute${minsOffline === 1 ? '' : 's'} of progress simulated.`;
      }

      // Emit event so UI can show the message
      bus.emit('offline_progress', { offlineMs: cappedMs, totalTicks, message: offlineMessage });
    }
  }

  // Initialize PhaseStateMachine from current state
  const currentPhase = (gameState.value.phase as Phase) ?? Phase.EGG_LAYING;
  const fsm = new PhaseStateMachine(currentPhase, TRANSITIONS);

  // Wire resource ticking into the game loop (dtSec = 0.05 for 50ms ticks)
  ticker.onTick((dtSec: number) => {
    const state = gameState.value;

    // Generate map if tiles are all empty (first tick)
    let workingState = state;
    if (state.mapTiles.length > 0 && state.mapTiles.every((t) => t.type === 'empty' && !t.discovered)) {
      workingState = mapSystem.generateMap(workingState);
    }

    // Get territory bonuses for resource production
    const bonuses = territorySystem.getBonuses(workingState);
    let newState = resourceSystem.tick(workingState, bonuses, dtSec);
    newState = soldierSystem.tick(newState);

    // Expedition system: tick timers and resolve completed ones
    newState = tickExpeditions(newState);
    for (const exp of newState.expeditions) {
      if (exp.ticksRemaining <= 0) {
        newState = resolveExpedition(newState, exp);
        // Emit expedition return event with result details
        const totalSent = exp.scouts + exp.warriors;
        const totalReturned =
          newState.soldiers.scouts -
          (workingState.soldiers.scouts - exp.scouts) +
          newState.soldiers.warriors -
          (workingState.soldiers.warriors - exp.warriors);
        const scoutsReturned = Math.min(exp.scouts, Math.max(0, newState.soldiers.scouts - (workingState.soldiers.scouts - exp.scouts)));
        const warriorsReturned = Math.min(exp.warriors, Math.max(0, newState.soldiers.warriors - (workingState.soldiers.warriors - exp.warriors)));

        let result = 'failure';
        if (scoutsReturned + warriorsReturned === totalSent) {
          result = 'success';
        } else if (scoutsReturned + warriorsReturned > 0) {
          result = 'partial';
        }

        const oldResources = workingState.resources;
        bus.emit('expedition_return', {
          destination: exp.destination,
          result,
          food: newState.resources.food - oldResources.food,
          stone: newState.resources.stone - oldResources.stone,
          nectar: newState.resources.nectar - oldResources.nectar,
          wood: newState.resources.wood - oldResources.wood,
          scoutsReturned,
          warriorsReturned,
          tilesDiscovered: newState.territory.ownedTiles - workingState.territory.ownedTiles,
        });
        workingState = newState;
      }
    }

    // Space exploration system: tick timers and resolve completed ones
    newState = tickExplorations(newState);
    for (const exp of newState.spaceExplorations) {
      if (exp.ticksRemaining <= 0) {
        newState = resolveExploration(newState, exp);
        // Emit exploration return event with result details
        const oldResources = workingState.resources;
        let result = 'success';
        if (newState.resources.voidCrystals === oldResources.voidCrystals &&
            newState.resources.antimatter === oldResources.antimatter &&
            newState.resources.darkMatter === oldResources.darkMatter) {
          result = 'failure';
        } else if (newState.resources.voidCrystals + newState.resources.antimatter + newState.resources.darkMatter <
                   oldResources.voidCrystals + oldResources.antimatter + oldResources.darkMatter + 1) {
          result = 'partial';
        }
        bus.emit('exploration_return', {
          destination: exp.destination,
          result,
          voidCrystals: newState.resources.voidCrystals - oldResources.voidCrystals,
          antimatter: newState.resources.antimatter - oldResources.antimatter,
          darkMatter: newState.resources.darkMatter - oldResources.darkMatter,
        });
        workingState = newState;
      }
    }

    // Spaceship system: tick missions and resolve returning ones
    newState = tickMissions(newState);
    for (const ship of newState.spaceships) {
      if (ship.status === 'returning') {
        const oldVoidCrystals = newState.resources.voidCrystals;
        const oldAntimatter = newState.resources.antimatter;
        const oldDarkMatter = newState.resources.darkMatter;
        newState = resolveMission(ship.id, newState);
        bus.emit('spaceship_return', {
          shipId: ship.id,
          destination: ship.destinationName,
          shipType: ship.type,
          shipLevel: ship.level,
          voidCrystals: newState.resources.voidCrystals - oldVoidCrystals,
          antimatter: newState.resources.antimatter - oldAntimatter,
          darkMatter: newState.resources.darkMatter - oldDarkMatter,
        });
        workingState = newState;
      }
    }

    // Advance playTimeMs by dt in ms (dtSec * 1000)
    newState = {
      ...newState,
      stats: {
        ...newState.stats,
        playTimeMs: newState.stats.playTimeMs + (dtSec * 1000),
      },
    };

    // Write to signal — triggers all UI effects
    gameState.value = newState;

    // Decision popup spawn check
    const decisionEvent = decisionSystem.popEvent(newState, newState.stats.playTimeMs);
    if (decisionEvent) {
      bus.emit('decision_event', decisionEvent);
    }

    // Check phase transitions
    const updated = gameState.value;
    const tickResult = fsm.tick(updated, bus);
    if (tickResult.phase !== updated.phase) {
      gameState.value = {
        ...tickResult.state,
        phase: tickResult.phase,
      };
    }
  });

  // Mount UI
  const app = document.getElementById('app');

  // Wire decision chosen → apply consequence to game state
  bus.subscribe('decision_chosen', (payload: unknown) => {
    const p = payload as { type: string; choice: string };
    const current = gameState.value;
    const newState = decisionSystem.applyChoice(current, p.type, p.choice);
    gameState.value = newState;
  });

  const ui = new UIRoot({
    bus,
    resourceSystem,
    soldierSystem,
    battleSystem,
    saveManager,
    mapSystem,
    territorySystem,
    getState: () => gameState.value,
    setState: (state: GameState) => { gameState.value = state; },
  });
  if (app) {
    ui.mount(app);
  }

  // Reveal panels for current phase
  phaseContent.onPhaseEnter(currentPhase as Phase, ui);
  // Ensure body class persists (some environments may clear it during boot)
  requestAnimationFrame(() => {
    const bodyClass = PhaseContent.getPhaseBodyClass(currentPhase as Phase);
    if (bodyClass && !document.body.classList.contains(bodyClass)) {
      document.body.classList.add(bodyClass);
    }
  });

  // Listen for phase changes to reveal new panels with transition animation
  bus.subscribe('phase_changed', (payload: unknown) => {
    const phase = (payload as { phase: string }).phase as Phase;
    phaseContent.triggerTransition(phase, bus, ui);
  });

  // If we have an offline message, show it after UI is mounted
  if (offlineMessage && ui) {
    bus.emit('offline_progress', { offlineMs: 0, totalTicks: 0, message: offlineMessage });
  }

  // Start autosave
  saveManager.startAutosave(() => ({
    state: gameState.value,
    playTimeMs: gameState.value.stats.playTimeMs,
  }));

  // Save on beforeunload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      const state = gameState.value;
      saveManager.save(state, state.stats.playTimeMs);
    });
  }

  loop.start();

  return { bus, ticker, loop, resourceSystem, saveManager, fsm, ui, decisionSystem };
}

/**
 * Process a single tick for offline catch-up simulation.
 * Extracted so it can be reused by the main tick loop and offline processing.
 */
function processTick(
  state: GameState,
  resourceSystem: ResourceSystem,
  soldierSystem: SoldierSystem,
  mapSystem: MapSystem,
  territorySystem: TerritorySystem,
  bus: EventBus,
  dtSec: number,
): GameState {
  let workingState = state;

  // Generate map if tiles are all empty
  if (state.mapTiles.length > 0 && state.mapTiles.every((t) => t.type === 'empty' && !t.discovered)) {
    workingState = mapSystem.generateMap(workingState);
  }

  const bonuses = territorySystem.getBonuses(workingState);
  let newState = resourceSystem.tick(workingState, bonuses, dtSec);
  newState = soldierSystem.tick(newState);

  // Tick expedition timers
  newState = tickExpeditions(newState);
  for (const exp of newState.expeditions) {
    if (exp.ticksRemaining <= 0) {
      newState = resolveExpedition(newState, exp);
    }
  }

  // Tick space exploration timers
  newState = tickExplorations(newState);
  for (const exp of newState.spaceExplorations) {
    if (exp.ticksRemaining <= 0) {
      newState = resolveExploration(newState, exp);
    }
  }

  // Tick spaceship missions
  newState = tickMissions(newState);
  for (const ship of newState.spaceships) {
    if (ship.status === 'returning') {
      newState = resolveMission(ship.id, newState);
    }
  }

  // Advance playTimeMs
  newState = {
    ...newState,
    stats: {
      ...newState.stats,
      playTimeMs: newState.stats.playTimeMs + (dtSec * 1000),
    },
  };

  return newState;
}

// Auto-bootstrap when loaded in browser.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__swarm = bootstrap();
}
