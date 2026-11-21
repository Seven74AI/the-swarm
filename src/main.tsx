import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { log } from './utils/log';
import { EventBus } from './engine/EventBus';
import { EventQueue, type EventSink } from './engine/events';
import type { TickContext } from './engine/TickContext';
import { createActions, type Actions } from './actions';
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
import { tickExplorations, resolveExploration, tickProbeSwarm } from './systems/ExplorationSystem';
import { tickResearch } from './systems/ResearchSystem';
import { tickConversions } from './systems/ResourceConversionSystem';
import { tickEntropy } from './systems/EntropySystem';
import {
  tickMissions,
  resolveMission,
} from './systems/SpaceshipSystem';
import { tickAutoProduction } from './engine/AutoProductionLoop';
import { processTick } from './engine/processTick';
import { getPrestigeBonuses } from './systems/PrestigeBonusSystem';
import { render } from 'preact';
import { computed } from '@preact/signals-core';
import { UIRoot } from './ui/UIRoot';
import { App } from './ui/App';
import { createTabShell } from './ui/shell/tabShell';
import { selectAffordableKeys, selectGoalMet, selectLifetime, selectPhase } from './state/selectors';
import { AudioSystem } from './ui/AudioSystem';
import { SaveManager } from './persistence/SaveManager';
import type { OfflineLoadInfo } from './persistence/SaveManager';
import { computeOfflineResourceDeltas } from './systems/OfflineProgression';
import { openOfflineSummary } from './ui/sheets/OfflineSummarySheet';
import { bindDecisionSheets } from './ui/sheets/DecisionSheet';
import { openTickFailure } from './ui/sheets/TickFailureSheet';
import { createSheetController, type SheetController } from './ui/shell/SheetController';
import { createResourceFeed } from './ui/shell/resourceFeed';
import { ResourceStrip } from './ui/shell/ResourceStrip';
import { PhaseLine } from './ui/shell/GoalMeter';
import { createOverlayController, type OverlayController } from './ui/shell/OverlayController';
import { bindPhaseReveal } from './ui/overlays/PhaseReveal';
import { NestPrimary } from './ui/nest/NestPrimary';
import { NestScene } from './ui/nest/NestScene';
import { ClickPowerCard } from './ui/nest/ClickPowerCard';
import { WorkersPrimary, WorkersTab } from './ui/wrkr/WorkersTab';
import { AutomationSection } from './ui/wrkr/AutomationSection';
import { BuildHeader } from './ui/build/BuildHeader';
import { BuildingCards } from './ui/build/BuildingCards';
import { ResearchCards } from './ui/build/ResearchCards';
import { ConverterCard } from './ui/build/ConverterCard';
import { BuildPrimary } from './ui/build/BuildPrimary';
import { PhaseStateMachine } from './phases/PhaseStateMachine';
import { Phase, PHASE_ORDER } from './phases/phases';
import { PhaseContent } from './ui/PhaseContent';
import { TRANSITIONS } from './phases/transitions';
import type { GameState } from './state/GameState';
import { OnboardingManager } from './ui/OnboardingManager';
import { bindPhaseTheme } from './ui/theme/phaseTheme';
import { bindReducedMotion } from './ui/theme/reducedMotion';
import { createWebPlatform, type Platform } from './platform';
import { bindHapticFeedback, bindSoundSetting } from './platform/feedback';

/**
 * THE SWARM — Bootstrap
 *
 * Full game loop with persistence, phase state machine, and autosave.
 * Uses @preact/signals-core for reactive state (one signal; the UI reads it through state/selectors).
 * - Load saved state on startup (or start fresh)
 * - Each tick: systems → PhaseStateMachine.latch → one signal write → flush queued events
 * - Autosave every 30 seconds
 * - PhaseContent manages which panels are active
 * - Fixed 50ms timestep with rAF-based delta accumulator
 * - Offline progress: accelerated catch-up on load (capped at 8 hours)
 */
export function bootstrap(): {
  bus: EventBus;
  ticker: Ticker;
  /** One live tick (the Ticker's callback), exposed for tests. */
  tick: (dtSec: number) => void;
  loop: GameLoop;
  resourceSystem: ResourceSystem;
  saveManager: SaveManager;
  fsm: PhaseStateMachine;
  ui: UIRoot;
  decisionSystem: DecisionSystem;
  audio: AudioSystem;
  actions: Actions;
  platform: Platform;
  sheets: SheetController;
  overlays: OverlayController;
} {
  // Platform services, built once and passed on (Story 1.10, D9). Only main
  // imports platform/ values; settings live under their own key, outside the save.
  const platform = createWebPlatform();
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
  // The phase flow: evaluate/latch every tick, commit only on CONTINUE (Story 1.19, D3)
  const fsm = new PhaseStateMachine(TRANSITIONS);

  // Try to load saved state
  const saved = saveManager.load();
  let offlineSummary: OfflineLoadInfo | null = null;

  if (saved) {
    gameState.value = saved.gameState;
    log.info('offline', `Save loaded. offline: ${saved.offline ? `ticks=${saved.offline.offlineTicks}` : 'null'}`);

    // GM-8 Offline progression: compute catch-up from save timestamp + efficiency
    if (saved.offline && saved.offline.offlineTicks > 0) {
      const offlineData: OfflineLoadInfo = saved.offline;
      log.info('offline', `Ticks to simulate: ${offlineData.offlineTicks} Elapsed: ${offlineData.elapsedMs} Efficiency: ${offlineData.efficiency}`);

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
      // Simulated ticks raise events into a collecting queue that is never
      // flushed: nothing plays or animates for catch-up (AR18). The summary
      // below is built from the before/after states.
      const dtSec = 50 / 1000; // 50ms per tick
      const offlineEvents = new EventQueue();
      for (let i = 0; i < offlineData.offlineTicks; i++) {
        catchUpState = processTick(
          catchUpState, resourceSystem, soldierSystem, mapSystem, territorySystem, offlineEvents, dtSec,
          true, // skipDeterministicResources — handled by closed-form above
        );
        // Catch-up never commits a phase, but the goal may latch (D2).
        catchUpState = fsm.latch(catchUpState);
        offlineEvents.clear();
      }

      gameState.value = catchUpState;

      // Show summary popup for absences >= 30 seconds
      if (offlineData.elapsedMs >= 30_000) {
        offlineSummary = offlineData;

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

  const currentPhase = (gameState.value.phase as Phase) ?? Phase.EGG_LAYING;

  // One live tick (dtSec = 0.05 for 50ms ticks).
  // Events raised during the tick are queued on the tick context and flushed
  // to the bus only after the tick's single state write (AR18), so listeners
  // always read the state the event describes.
  const step = (state: GameState, ctx: TickContext): GameState => {
    // ── Pause guard: skip all tick processing when paused ──
    if (state.paused) return state;

    const { dtSec, events } = ctx;

    // Generate map if tiles are all empty (first tick)
    let workingState = state;
    if (state.mapTiles.length > 0 && state.mapTiles.every((t) => t.type === 'empty' && !t.discovered)) {
      workingState = mapSystem.generateMap(workingState);
    }

    // Get territory bonuses for resource production
    const bonuses = territorySystem.getBonuses(workingState);
    let newState = resourceSystem.tick(workingState, bonuses, dtSec, false, events);

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

    newState = soldierSystem.tick(newState, dtSec, events);
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
    newState = tickExpeditions(newState, dtSec);
    for (const exp of newState.expeditions) {
      if (exp.remainingMs <= 0) {
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

        let result: 'success' | 'partial' | 'failure' = 'failure';
        if (scoutsReturned + warriorsReturned === totalSent) {
          result = 'success';
        } else if (scoutsReturned + warriorsReturned > 0) {
          result = 'partial';
        }

        const oldResources = workingState.resources;
        events.emit('expedition_return', {
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
    newState = tickExplorations(newState, dtSec);
    for (const exp of newState.spaceExplorations) {
      if (exp.remainingMs <= 0) {
        newState = resolveExploration(newState, exp);
        // Emit exploration return event with result details
        const oldResources = workingState.resources;
        let result: 'success' | 'partial' | 'failure' = 'success';
        if (newState.resources.voidCrystals === oldResources.voidCrystals &&
            newState.resources.antimatter === oldResources.antimatter &&
            newState.resources.darkMatter === oldResources.darkMatter) {
          result = 'failure';
        } else if (newState.resources.voidCrystals + newState.resources.antimatter + newState.resources.darkMatter <
                   oldResources.voidCrystals + oldResources.antimatter + oldResources.darkMatter + 1) {
          result = 'partial';
        }
        events.emit('exploration_return', {
          destination: exp.destination,
          result,
          voidCrystals: newState.resources.voidCrystals - oldResources.voidCrystals,
          antimatter: newState.resources.antimatter - oldResources.antimatter,
          darkMatter: newState.resources.darkMatter - oldResources.darkMatter,
        });
        workingState = newState;
      }
    }

    // Probe Swarm: auto-launch explorations when enough surveyData accumulated
    newState = tickProbeSwarm(newState);
    workingState = newState;

    // Spaceship system: tick missions and resolve returning ones
    newState = tickMissions(newState);
    for (const ship of newState.spaceships) {
      if (ship.status === 'returning') {
        const oldVoidCrystals = newState.resources.voidCrystals;
        const oldAntimatter = newState.resources.antimatter;
        const oldDarkMatter = newState.resources.darkMatter;
        newState = resolveMission(ship.id, newState);
        events.emit('spaceship_return', {
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
    newState = tickResearch(newState, dtSec);

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

    // Decision popup spawn check
    const decisionEvent = decisionSystem.popEvent(newState, newState.stats.playTimeMs);
    if (decisionEvent) {
      events.emit('decision_event', decisionEvent);
    }

    // The phase never changes in a tick (Story 1.19, D3): a met goal only
    // latches. The player commits it with CONTINUE (actions.continuePhase).
    newState = fsm.latch(newState);

    return newState;
  };
  // The tick boundary (Story 1.17, AR16): GameLoop runs `step`, makes the
  // tick's one state write (which triggers all UI effects), and only then
  // flushes the tick's events. A tick that throws writes nothing and raises
  // nothing; 3 in a row stop the simulation and call onTickHalt (below).
  let haltedSnapshot: GameState | null = null;
  const tick = loop.bindTick({
    read: () => gameState.value,
    step,
    write: (next) => {
      gameState.value = next;
    },
    flush: (events) => events.flushTo(bus),
    onHalt: () => onTickHalt(),
  });

  // Mount UI
  const app = document.getElementById('app');

  // Phase palette (Story 1.8): one attribute on <html> rebinds the color aliases.
  bindPhaseTheme(document.documentElement);
  // Reduced motion in effect (Story 1.10 setting, OS by default) as one root attribute (Story 1.11).
  bindReducedMotion(document.documentElement, platform.settings.reducedMotion);

  // Every player intent goes through an action (Story 1.6): the UI never
  // writes state or touches a system. Decision choices are an action too,
  // not a listener: no listener writes state (AR18).
  const actions = createActions({ bus, resourceSystem, soldierSystem, battleSystem, decisionSystem, territorySystem, phases: fsm });

  // One sheet at a time (Story 1.14, D7): every sheet is requested here, drawn by App.
  const sheets = createSheetController();
  // The overlay layer (Story 1.20, D7): while an overlay is up, sheets and decision events wait.
  // It marks <html data-overlay-active>, which turns on the phase reveal's palette cross-fade.
  const overlays = createOverlayController(document.documentElement);
  bindPhaseReveal({
    bus,
    overlays,
    revealsSeen: () => selectLifetime.peek().revealsSeen,
    markSeen: (phase) => actions.markRevealSeen(phase),
    reducedMotion: platform.settings.reducedMotion,
  });
  bindDecisionSheets({ bus, sheets, choose: (type, choice) => actions.chooseDecision(type, choice) });
  const resourceFeed = createResourceFeed();
  // The lay-mode setting (hold / toggle) for NEST's LAY EGG (Story 1.22).
  const layMode = computed(() => platform.settings.settings.value.layMode);

  // After 3 failed ticks (Story 1.17): keep the last good snapshot as THE save
  // (stop autosave, write it now, and every later save writes it too), then
  // offer EXPORT SAVE and RELOAD.
  const onTickHalt = (): void => {
    const snapshot = gameState.value;
    haltedSnapshot = snapshot;
    saveManager.stopAutosave();
    saveManager.save(snapshot, snapshot.stats.playTimeMs, true);
    openTickFailure(sheets, {
      onExport: () => {
        const text = saveManager.serialize(snapshot, snapshot.stats.playTimeMs);
        if (!platform.browser.download('the-swarm-save.json', text)) log.warn('save', 'export download failed');
      },
      onReload: () => platform.browser.reload(),
    });
  };

  const ui = new UIRoot({
    bus,
    actions,
    saveManager,
    getState: () => gameState.value,
    audio,
    loop,
    // Irreversible actions read the confirm style and hold duration from the settings (Story 1.13).
    confirmSettings: platform.settings.settings,
    // The resource strip and resource sheet (Story 1.16) share one sampled feed (ADR 0012).
    mountStrip: (host) => render(<ResourceStrip feed={resourceFeed} sheets={sheets} />, host),
    // NEST's phase line and goal meter (Story 1.18), from the conditions in transitions.ts.
    mountPhaseLine: (host) => render(<PhaseLine host={host} />, host),
    // NEST (Story 1.22): LAY EGG in Phase 1, then the next action; the scene area; the Click Power card.
    mountNest: {
      primary: (host) => render(<NestPrimary actions={actions} layMode={layMode} />, host),
      scene: (host) => render(<NestScene lay={actions.layEgg} />, host),
      clickPower: (host) => render(<ClickPowerCard buy={() => actions.buyUpgrade('click_power')} />, host),
    },
    // WRKR (Story 1.23): role rows and upkeep readout, the reallocation primary action, automation.
    mountWorkers: {
      tab: (host) => render(<WorkersTab actions={actions} />, host),
      primary: (host) => render(<WorkersPrimary actions={actions} />, host),
      automation: (host) => render(<AutomationSection actions={actions} />, host),
    },
    // BUILD (Story 1.24): header, Click Power (Phase 2+), buildings, research, converter; > BUY on the highlighted card.
    mountBuild: {
      header: (host) => render(<BuildHeader />, host),
      clickPower: (host) => render(<ClickPowerCard place="build" buy={() => actions.buyUpgrade('click_power')} />, host),
      buildings: (host) => render(<BuildingCards buy={(id) => actions.buyBuilding(id)} />, host),
      research: (host) =>
        render(
          <ResearchCards
            start={(id) => actions.startResearch(id)}
            cancel={(id) => actions.cancelResearch(id)}
            confirmSettings={platform.settings.settings}
          />,
          host,
        ),
      converter: (host) => render(<ConverterCard convert={() => actions.runConversions()} />, host),
      primary: (host) => render(<BuildPrimary perform={(intent) => actions.perform(intent)} />, host),
    },
  });
  if (app) {
    // The Preact root hosts the legacy UIRoot (Story 1.7). render() mounts it synchronously,
    // so the panels exist before the phase's panels are revealed below.
    // The tab shell (Story 1.15): tabs revealed by phase, `•` from what became affordable.
    // A latched goal (Story 1.19): `•` on NEST and CONTINUE as its primary action.
    const shell = createTabShell({ phase: selectPhase, affordable: selectAffordableKeys, goalMet: selectGoalMet });
    render(<App legacy={ui} shell={shell} sheets={sheets} overlays={overlays} onContinue={actions.continuePhase} />, app);
  }

  // Start onboarding tutorial for new players (persisted via localStorage)
  setTimeout(() => {
    const onboarding = new OnboardingManager();
    onboarding.start();
  }, 500);

  // Reveal panels for current phase
  phaseContent.onPhaseEnter(currentPhase as Phase, ui);
  // Ensure body class persists (some environments may clear it during boot)
  requestAnimationFrame(() => {
    const bodyClass = PhaseContent.getPhaseBodyClass(currentPhase as Phase);
    if (bodyClass && !document.body.classList.contains(bodyClass)) {
      document.body.classList.add(bodyClass);
    }
  });

  // A committed phase reveals its panels at once, under the phase reveal (Story 1.20).
  bus.subscribe('phase_committed', ({ to }) => {
    phaseContent.onPhaseEnter(to, ui);
  });

  // ── Haptics and the sound setting (Story 1.10) ──
  bindHapticFeedback(bus, platform.haptics);
  bindSoundSetting(audio, platform.settings.settings);

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
  // A laid egg: the key click (the light haptic is bound above, Story 1.22).
  bus.subscribe('egg_clicked', () => {
    audio.play('click');
  });
  bus.subscribe('expedition_return', () => {
    audio.play('discovery');
  });
  bus.subscribe('exploration_return', () => {
    audio.play('discovery');
  });
  bus.subscribe('spaceship_return', () => {
    audio.play('discovery');
  });

  // The offline summary opens once the UI is mounted. Its priority puts it ahead
  // of any decision sheet the first ticks request (Story 1.14).
  if (offlineSummary) openOfflineSummary(sheets, offlineSummary);

  // Start autosave
  saveManager.startAutosave(() => ({
    state: gameState.value,
    playTimeMs: gameState.value.stats.playTimeMs,
  }));

  // Save on beforeunload (forced — always saves regardless of rate limit)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      // Once the simulation has halted, only the last good snapshot is ever saved.
      const state = haltedSnapshot ?? gameState.value;
      saveManager.save(state, state.stats.playTimeMs, true);
    });
  }

  // Save on meaningful user actions (rate-limited to max 1 per 5s via SaveManager)
  const actionSave = () => {
    const state = haltedSnapshot ?? gameState.value;
    saveManager.save(state, state.stats.playTimeMs);
  };

  bus.subscribe('battle_completed', actionSave);
  bus.subscribe('egg_clicked', actionSave);
  bus.subscribe('prestige_triggered', actionSave);
  bus.subscribe('upgrade_purchased', actionSave);
  bus.subscribe('prestige_upgrade_purchased', actionSave);
  bus.subscribe('expedition_return', actionSave);
  bus.subscribe('exploration_return', actionSave);

  // Force unpause on load — game always starts running
  const unpausedState = gameState.value;
  if (unpausedState.paused) {
    gameState.value = { ...unpausedState, paused: false };
  }

  loop.start();

  return { bus, ticker, tick, loop, resourceSystem, saveManager, fsm, ui, decisionSystem, audio, actions, platform, sheets, overlays };
}

// processTick lives in engine/processTick.ts; re-exported for existing callers.
export { processTick };

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
