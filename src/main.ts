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
import { tickResearch } from './systems/ResearchSystem';
import { tickConversions } from './systems/ResourceConversionSystem';
import { tickEntropy } from './systems/EntropySystem';
import {
  tickMissions,
  resolveMission,
} from './systems/SpaceshipSystem';
import { tickAutoProduction } from './engine/AutoProductionLoop';
import { getPrestigeBonuses } from './systems/PrestigeBonusSystem';
import { UIRoot } from './ui/UIRoot';
import { AudioSystem } from './ui/AudioSystem';
import { SaveManager } from './persistence/SaveManager';
import type { OfflineLoadInfo } from './persistence/SaveManager';
import { computeOfflineResourceDeltas } from './systems/OfflineProgression';
import { OfflineSummaryPopup } from './ui/components/OfflineSummaryPopup';
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
  audio: AudioSystem;
} {
  const bus = new EventBus();
  const ticker = new Ticker();
  const resourceSystem = new ResourceSystem(bus);
  const soldierSystem = new SoldierSystem(bus);
  const battleSystem = new BattleSystem(bus);
  const decisionSystem = new DecisionSystem(bus);
  const saveManager = new SaveManager();
  const audio = new AudioSystem();
  const loop = new GameLoop(ticker);
  const phaseContent = new PhaseContent();
  const mapSystem = new MapSystem();
  const territorySystem = new TerritorySystem();

  // Try to load saved state
  const saved = saveManager.load();
  let offlinePopup: OfflineSummaryPopup | null = null;

  if (saved) {
    gameState.value = saved.gameState;
    console.log('[Offline] Save loaded. offline:', saved.offline ? `ticks=${saved.offline.offlineTicks}` : 'null');

    // GM-8 Offline progression: compute catch-up from save timestamp + efficiency
    if (saved.offline && saved.offline.offlineTicks > 0) {
      const offlineData: OfflineLoadInfo = saved.offline;
      console.log('[Offline] Ticks to simulate:', offlineData.offlineTicks, 'Elapsed:', offlineData.elapsedMs, 'Efficiency:', offlineData.efficiency);

      // Capture before-state for resource delta calculation
      const beforeState = gameState.value;

      // ─── Closed-form resource computation (rate × time) ───
      // Deterministic resources (food, wood, stone) use a single bulk computation
      // instead of per-tick summation. This is O(1) instead of O(ticks) for
      // resource math, making offline catch-up faster.
      const totalDtSec = offlineData.effectiveMs / 1000;
      const territoryBonuses = territorySystem.getBonuses(gameState.value);
      const resourceDeltas = computeOfflineResourceDeltas(
        gameState.value,
        totalDtSec,
        territoryBonuses,
      );

      // Apply closed-form resource deltas
      let catchUpState = {
        ...gameState.value,
        resources: {
          ...gameState.value.resources,
          food: gameState.value.resources.food + resourceDeltas.foodDelta,
          wood: gameState.value.resources.wood + resourceDeltas.woodDelta,
          stone: gameState.value.resources.stone + resourceDeltas.stoneDelta,
          nectar: gameState.value.resources.nectar + resourceDeltas.nectarDelta,
        },
        prestige: {
          ...gameState.value.prestige,
          totalFoodProduced: gameState.value.prestige.totalFoodProduced + resourceDeltas.grossFoodProduced,
        },
      };

      // ─── Tick-based catch-up: only non-linear events ───
      // Run the tick loop for pipelines (eggs→larvae→workers/soldiers),
      // battles, expeditions, and other non-deterministic events.
      // Deterministic resource deltas are skipped (applied above via closed-form).
      const dtSec = 50 / 1000; // 50ms per tick
      for (let i = 0; i < offlineData.offlineTicks; i++) {
        catchUpState = processTick(
          catchUpState, resourceSystem, soldierSystem, mapSystem, territorySystem, bus, dtSec,
          true, // skipDeterministicResources — handled by closed-form above
        );
      }

      gameState.value = catchUpState;

      // Show summary popup for absences >= 30 seconds
      if (offlineData.elapsedMs >= 30_000) {
        offlinePopup = new OfflineSummaryPopup(offlineData, () => {
          // Dismiss: game continues normally — UI is already mounted
        });
        console.log('[Offline] Popup created:', !!offlinePopup);

        // Emit event for resource delta tracking
        bus.emit('offline_progress', {
          elapsedMs: offlineData.elapsedMs,
          offlineTicks: offlineData.offlineTicks,
          efficiency: offlineData.efficiency,
          resourcesBefore: beforeState.resources,
          resourcesAfter: catchUpState.resources,
        });
      }
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

    // Track gross food produced for prestige system
    const workers = workingState.resources.workers;
    const assigned = workingState.workersAssigned;
    const gatherCount = assigned.gather;
    const unassignedCount = workers - gatherCount - assigned.tend - assigned.dig - assigned.guard;
    const baseFoodProduced = gatherCount * 2 + Math.max(0, unassignedCount) * 1;
    const territoryFood = Math.floor(workers * (bonuses.food ?? 0));
    const grossFoodProduced = (baseFoodProduced + territoryFood) * dtSec;
    newState = {
      ...newState,
      prestige: {
        ...newState.prestige,
        totalFoodProduced: newState.prestige.totalFoodProduced + grossFoodProduced,
      },
    };

    newState = soldierSystem.tick(newState);
    newState = tickAutoProduction(newState, dtSec);

    // Auto-egg-layer from prestige tree (1 egg/sec)
    const prestigeBonuses = getPrestigeBonuses(newState);
    if (prestigeBonuses.autoEggLayer) {
      newState = {
        ...newState,
        resources: {
          ...newState.resources,
          eggs: newState.resources.eggs + dtSec,
        },
        stats: {
          ...newState.stats,
          totalEggsLaid: newState.stats.totalEggsLaid + dtSec,
        },
        eggPipeline: {
          ...newState.eggPipeline,
          count: newState.eggPipeline.count + dtSec,
        },
      };
    }

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

    // Research system: tick research progress
    newState = tickResearch(newState);

    // Resource conversions: tick DAG (GM-4)
    newState = tickConversions(newState, dtSec);

    // Entropy: accumulate from darkMatter production (GM-10)
    newState = tickEntropy(newState, dtSec);

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
    audio,
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

  // ── Audio: wire sound effects to game events ──
  bus.subscribe('prestige_triggered', () => {
    audio.play('prestige');
  });
  bus.subscribe('battle_completed', () => {
    audio.play('battle');
  });
  bus.subscribe('battle_engage', () => {
    audio.play('battle');
  });
  bus.subscribe('expedition_return', () => {
    audio.play('discovery');
  });
  bus.subscribe('exploration_return', () => {
    audio.play('discovery');
  });

  console.log('[Offline] Before mount check. offlinePopup is:', !!offlinePopup);

  // If we have an offline popup, mount it after UI is mounted
  if (offlinePopup) {
    console.log('[Offline] Mounting popup...');
    offlinePopup.mount(document.body);
    console.log('[Offline] Popup mounted. Body has overlay:', !!document.querySelector('.offline-overlay'));
  }

  // Start autosave
  saveManager.startAutosave(() => ({
    state: gameState.value,
    playTimeMs: gameState.value.stats.playTimeMs,
  }));

  // Save on beforeunload (forced — always saves regardless of rate limit)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      const state = gameState.value;
      saveManager.save(state, state.stats.playTimeMs, true);
    });
  }

  // Save on meaningful user actions (rate-limited to max 1 per 5s via SaveManager)
  const actionSave = () => {
    const state = gameState.value;
    saveManager.save(state, state.stats.playTimeMs);
  };

  bus.subscribe('battle_completed', actionSave);
  bus.subscribe('prestige_triggered', actionSave);
  bus.subscribe('upgrade_purchased', actionSave);
  bus.subscribe('prestige_upgrade_purchased', actionSave);
  bus.subscribe('expedition_return', actionSave);
  bus.subscribe('exploration_return', actionSave);

  loop.start();

  return { bus, ticker, loop, resourceSystem, saveManager, fsm, ui, decisionSystem, audio };
}

/**
 * Process a single tick for offline catch-up simulation.
 * Extracted so it can be reused by the main tick loop and offline processing.
 */
export function processTick(
  state: GameState,
  resourceSystem: ResourceSystem,
  soldierSystem: SoldierSystem,
  mapSystem: MapSystem,
  territorySystem: TerritorySystem,
  bus: EventBus,
  dtSec: number,
  skipDeterministicResources: boolean = false,
): GameState {
  let workingState = state;

  // Generate map if tiles are all empty
  if (state.mapTiles.length > 0 && state.mapTiles.every((t) => t.type === 'empty' && !t.discovered)) {
    workingState = mapSystem.generateMap(workingState);
  }

  const bonuses = territorySystem.getBonuses(workingState);
  let newState = resourceSystem.tick(workingState, bonuses, dtSec, skipDeterministicResources);

  // Track gross food produced for prestige system
  // Skip when using closed-form offline computation (already counted above)
  if (!skipDeterministicResources) {
    const pWorkers = workingState.resources.workers;
    const pAssigned = workingState.workersAssigned;
    const pGatherCount = pAssigned.gather;
    const pUnassignedCount = pWorkers - pGatherCount - pAssigned.tend - pAssigned.dig - pAssigned.guard;
    const pBaseFoodProduced = pGatherCount * 2 + Math.max(0, pUnassignedCount) * 1;
    const pTerritoryFood = Math.floor(pWorkers * (bonuses.food ?? 0));
    const pGrossFoodProduced = (pBaseFoodProduced + pTerritoryFood) * dtSec;
    newState = {
      ...newState,
      prestige: {
        ...newState.prestige,
        totalFoodProduced: newState.prestige.totalFoodProduced + pGrossFoodProduced,
      },
    };
  }

  newState = soldierSystem.tick(newState);
  newState = tickAutoProduction(newState, dtSec);

  // Auto-egg-layer from prestige tree (1 egg/sec)
  const pBonuses = getPrestigeBonuses(newState);
  if (pBonuses.autoEggLayer) {
    newState = {
      ...newState,
      resources: {
        ...newState.resources,
        eggs: newState.resources.eggs + dtSec,
      },
      stats: {
        ...newState.stats,
        totalEggsLaid: newState.stats.totalEggsLaid + dtSec,
      },
      eggPipeline: {
        ...newState.eggPipeline,
        count: newState.eggPipeline.count + dtSec,
      },
    };
  }

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

  // Tick research progress
  newState = tickResearch(newState);

  // Resource conversions
  newState = tickConversions(newState, dtSec);

  // Entropy accumulation (GM-10)
  newState = tickEntropy(newState, dtSec);

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
  const swarm = bootstrap();
  // Expose debug accessor for E2E tests (matches swarm.manager.getState() in existing tests)
  (swarm as Record<string, unknown>).manager = {
    getState: () => gameState.value,
    setState: (s: GameState) => { gameState.value = s; },
  };
  (window as unknown as Record<string, unknown>).__swarm = swarm;
}
