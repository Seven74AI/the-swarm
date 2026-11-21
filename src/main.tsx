import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/motion.css';
import { log } from './utils/log';
import { EventBus } from './engine/EventBus';
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
import { startDecisionSession, tickDecisions } from './systems/DecisionSystem';
import { getDecision, timeoutLine } from './data/content/decisions';
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
import { catchUp, type CatchUpDeps } from './engine/catchUp';
import { createResumePath, resume, type OfflineLoadInfo } from './engine/resume';
import { getPrestigeBonuses } from './systems/PrestigeBonusSystem';
import { render } from 'preact';
import { computed, effect, signal } from '@preact/signals-core';
import { App } from './ui/App';
import { gameViews } from './ui/gameViews';
import { EventLog } from './ui/log/EventLog';
import { createPanelReveal, type PanelReveal } from './ui/shell/panelReveal';
import { createTabShell } from './ui/shell/tabShell';
import { selectAffordableKeys, selectCanChoose, selectCapacityReached, selectGoalMet, selectStarving, selectLifetime, selectOpenDecision, selectPaused, selectPhase } from './state/selectors';
import { AudioSystem } from './ui/AudioSystem';
import { SaveManager } from './persistence/SaveManager';
import { openOfflineSummary } from './ui/sheets/OfflineSummarySheet';
import { bindDecisionSheets, type DecisionSheets } from './ui/sheets/DecisionSheet';
import { createToasts, type Toasts } from './ui/primitives/Toast';
import { openTickFailure } from './ui/sheets/TickFailureSheet';
import { openSettings } from './ui/sheets/SettingsSheet';
import { buildDiagnostics, DIAGNOSTICS_FILENAME } from './debug/diagnostics';
import { createTickTimings } from './debug/timings';
import { debugEnabled } from './debug/enabled';
import type { Cheats } from './debug/cheats';
import { randomSeed } from './state/seed';
import { createSheetController, type SheetController } from './ui/shell/SheetController';
import { bindShortcuts } from './ui/shell/shortcuts';
import { bindTips } from './ui/shell/tips';
import { createResourceFeed } from './ui/shell/resourceFeed';
import { createOverlayController, type OverlayController } from './ui/shell/OverlayController';
import { bindPhaseReveal } from './ui/overlays/PhaseReveal';
import { createWarSession } from './ui/war/warSession';
import { openBattleSummary } from './ui/sheets/BattleSummarySheet';
import { createLineJump } from './ui/log/jump';
import { createChronicle, type Chronicle } from './state/chronicle';
import { PhaseStateMachine } from './phases/PhaseStateMachine';
import { Phase, PHASE_ORDER } from './phases/phases';
import { PhaseContent } from './ui/PhaseContent';
import { TRANSITIONS } from './phases/transitions';
import type { GameState } from './state/GameState';
import { OnboardingManager } from './ui/OnboardingManager';
import { bindPhaseTheme } from './ui/theme/phaseTheme';
import { bindCrt, bindReducedMotion } from './ui/theme/reducedMotion';
import { createAnnouncer } from './ui/shell/announcer';
import { bindAnnouncements, battleLine, SAVE_FAILED_LINE, SAVE_RECOVERED_LINE } from './ui/shell/announcements';
import { SaveFailedMarker } from './ui/shell/SaveFailedMarker';
import { openUnreadableSave } from './ui/sheets/UnreadableSaveSheet';
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
 * - Every return (cold load, tab return, long frame) goes through one resume path (engine/resume.ts)
 */
/** The build in diagnostics: the commit Vite was given (`__BUILD_ID__`), or `dev`. */
const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

export function bootstrap(): {
  bus: EventBus;
  ticker: Ticker;
  /** One live tick (the Ticker's callback), exposed for tests. */
  tick: (dtSec: number) => void;
  loop: GameLoop;
  resourceSystem: ResourceSystem;
  saveManager: SaveManager;
  fsm: PhaseStateMachine;
  /** Which panels the session has revealed (Story 1.36; UIRoot is gone). */
  panels: PanelReveal;
  audio: AudioSystem;
  actions: Actions;
  platform: Platform;
  sheets: SheetController;
  overlays: OverlayController;
  /** The event lines, saved with the game (Story 1.26). */
  chronicle: Chronicle;
  /** One-line toasts (Story 1.12 primitive; first used by Story 1.28's costly timeouts). */
  toasts: Toasts;
  /** Dev builds only (Story 1.34): the cheats, once their chunk has loaded; null in production. */
  cheatsLoaded: Promise<Cheats> | null;
} {
  // Platform services, built once and passed on (Story 1.10, D9). Only main
  // imports platform/ values; settings live under their own key, outside the save.
  const platform = createWebPlatform();
  const bus = new EventBus();
  const ticker = new Ticker();
  const resourceSystem = new ResourceSystem(bus);
  const soldierSystem = new SoldierSystem(bus);
  const battleSystem = new BattleSystem(bus);
  // The save lives behind the platform SaveStore (Story 2.2, D4): primary, 2 backups, the unreadable copy.
  const saveManager = new SaveManager(platform.saves);
  const audio = new AudioSystem();
  const loop = new GameLoop(ticker);
  const phaseContent = new PhaseContent();
  const mapSystem = new MapSystem();
  const territorySystem = new TerritorySystem();
  // The phase flow: evaluate/latch every tick, commit only on CONTINUE (Story 1.19, D3)
  const fsm = new PhaseStateMachine(TRANSITIONS);
  // Offline catch-up (engine/catchUp.ts): resume-on-load and the dev time skip (Story 1.34).
  const catchUpDeps: CatchUpDeps = { resourceSystem, soldierSystem, mapSystem, territorySystem, latch: (s) => fsm.latch(s) };
  // The debug overlay's numbers (Story 1.34): how long resume took, and every tick's step.
  let catchUpMs: number | null = null;
  // Set after 3 failed ticks (Story 1.17): the only state ever saved from then on.
  let haltedSnapshot: GameState | null = null;
  const tickTimings = createTickTimings();

  // Read the save and what was found (Story 2.2). An unreadable save is never reset:
  // SaveManager now refuses every save until the player picks LOAD BACKUP or START OVER.
  const opened = saveManager.open();
  const saved = opened.state ?? null;
  let offlineSummary: OfflineLoadInfo | null = null;
  // The event lines (Story 1.26, ADR 0018): kept beside the game state, written into every save.
  const chronicle = createChronicle(saved?.chronicle);
  saveManager.setChronicleSource(() => chronicle.snapshot());

  if (!saved) {
    // A new game draws its seed (Story 1.34, D6); a loaded one keeps the seed in its save.
    gameState.value = { ...gameState.value, seed: randomSeed(Math.random) };
  }
  if (saved) {
    // Pause is in-session only (ADR 0002): the game always reopens running.
    gameState.value = { ...saved.gameState, paused: false };
    log.info('offline', `Save loaded. lastSeenAt: ${saved.lastSeenAt ?? 'null'}`);
  }

  // ── The one way back (Story 2.3, D1, ADR 0002) ──
  // Cold load, tab return, bfcache pageshow, focus after sleep and long frames all
  // call resume(elapsedMs) through this path. Under 60 s: full efficiency, no sheet.
  // 60 s or more: the offline path and its summary.
  let uiReady = false;
  const resumePath = createResumePath({
    now: () => Date.now(),
    read: () => gameState.value,
    write: (next) => {
      gameState.value = next;
    },
    // Timed for the debug overlay (Story 1.34).
    resume: (state, elapsedMs) => {
      const start = performance.now();
      const result = resume(state, elapsedMs, catchUpDeps);
      catchUpMs = Math.round(performance.now() - start);
      return result;
    },
    // Forced; once the simulation has halted, only the last good snapshot is ever saved.
    save: () => {
      const state = haltedSnapshot ?? gameState.value;
      saveManager.save(state, state.stats.playTimeMs, true);
    },
    ticker: loop,
    halted: () => loop.isHalted(),
    onResumed: (result, before) => {
      const info = result.offline;
      if (!info) return;
      log.info('offline', `Ticks to simulate: ${info.offlineTicks} Elapsed: ${info.elapsedMs} Efficiency: ${info.efficiency}`);
      log.info('offline', `caught up in ${catchUpMs} ms`);
      bus.emit('offline_progress', {
        elapsedMs: info.elapsedMs,
        offlineTicks: info.offlineTicks,
        efficiency: info.efficiency,
        resourcesBefore: before.resources,
        resourcesAfter: result.state.resources,
      });
      // The summary opens once the UI is mounted (below), ahead of any decision sheet.
      if (uiReady) openOfflineSummary(sheets, info);
      else offlineSummary = info;
    },
  });
  // Every save says when its state was last simulated to: the hide moment while hidden.
  saveManager.setSeenAtSource(() => resumePath.seenAt());

  // A new session for decision events (Story 1.28, D8): an open event comes back with
  // its time left; the spawn time is drawn again on the session clock, so no event
  // spawns in the first 2 minutes of foreground play, however long the save has run.
  gameState.value = startDecisionSession(gameState.value);
  // The session clock: ms of foreground ticks since this launch (never offline time).
  let sessionMs = 0;
  // Set once the UI is mounted (below); the tick only reads them.
  let decisionSheets: DecisionSheets | null = null;
  let decisionGate: () => boolean = () => false;

  const currentPhase = (gameState.value.phase as Phase) ?? Phase.EGG_LAYING;

  // One live tick (dtSec = 0.05 for 50ms ticks).
  // Events raised during the tick are queued on the tick context and flushed
  // to the bus only after the tick's single state write (AR18), so listeners
  // always read the state the event describes.
  const step = (state: GameState, ctx: TickContext): GameState => {
    // ── Pause guard: skip all tick processing when paused ──
    if (state.paused) return state;

    const { dtSec, events } = ctx;
    sessionMs += Math.round(dtSec * 1000);

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

    // Decision events (Story 1.28, D8): spawn on the session clock, count down on game
    // time only while the sheet is on screen, time out through applyChoice.
    newState = tickDecisions(newState, {
      sessionMs,
      dtMs: Math.round(dtSec * 1000),
      shown: decisionSheets?.shown() ?? false,
      canSpawn: decisionGate(),
      timers: platform.settings.settings.peek().decisionTimers,
      rand: Math.random,
      events,
    });

    // The phase never changes in a tick (Story 1.19, D3): a met goal only
    // latches. The player commits it with CONTINUE (actions.continuePhase).
    newState = fsm.latch(newState);

    return newState;
  };
  // The tick boundary (Story 1.17, AR16): GameLoop runs `step`, makes the
  // tick's one state write (which triggers all UI effects), and only then
  // flushes the tick's events. A tick that throws writes nothing and raises
  // nothing; 3 in a row stop the simulation and call onTickHalt (below).
  const tick = loop.bindTick({
    read: () => gameState.value,
    // Timed for the debug overlay's tick p50/p95 (Story 1.34).
    step: (state, ctx) => tickTimings.measure(() => step(state, ctx)),
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
  // CRT effects in effect (Story 1.32): OFF under reduced motion; Story 8.4 draws them.
  bindCrt(document.documentElement, platform.settings.crt);

  // Every player intent goes through an action (Story 1.6): the UI never
  // writes state or touches a system. Decision choices are an action too,
  // not a listener: no listener writes state (AR18).
  const actions = createActions({ bus, resourceSystem, soldierSystem, battleSystem, territorySystem, phases: fsm });

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
  // The decision sheet renders state.decision.open (Story 1.28): it reopens after a reload,
  // behind the offline summary and any overlay, and its countdown waits while it does.
  decisionSheets = bindDecisionSheets({
    sheets,
    open: selectOpenDecision,
    held: overlays.held,
    timers: computed(() => platform.settings.settings.value.decisionTimers),
    canChoose: selectCanChoose,
    choose: (choice) => actions.chooseDecision(choice),
    memory: platform.settings,
  });
  // No event spawns while an overlay or the offline summary is up (D8).
  decisionGate = () => {
    if (overlays.held.peek()) return false;
    const s = sheets.state.peek();
    return s.open?.priority !== 'offline' && !s.queue.some((q) => q.priority === 'offline');
  };
  // A costly timeout is logged (EventLog) and toasted once (Story 1.28).
  const toasts = createToasts();
  // The polite live region (Story 1.32, UX-DR40): key changes are announced once, values never per tick.
  const announcer = createAnnouncer();
  bindAnnouncements({
    bus,
    announcer,
    goalMet: selectGoalMet,
    starving: selectStarving,
    capacityReached: selectCapacityReached,
  });
  // A failed save is toasted (the toast host is a polite status region) and written to the log.
  saveManager.onSaveFailed(() => {
    toasts.show(SAVE_FAILED_LINE);
    bus.emit('narrative', { message: SAVE_FAILED_LINE });
  });
  // `• SAVE FAILED` under the strip while writes fail; cleared by the next good write (Story 2.2).
  const saveFailing = signal(saveManager.isFailing());
  saveManager.onSaveStatus((failing) => {
    saveFailing.value = failing;
  });
  // A save rebuilt from its backup is told once (the next save writes the primary again).
  if (opened.status === 'recoveredFromBackup') toasts.show(SAVE_RECOVERED_LINE);
  bus.subscribe('decision_resolved', ({ id, timedOut, policy }) => {
    if (timedOut && policy === 'costly') toasts.show(timeoutLine(getDecision(id)));
  });
  const resourceFeed = createResourceFeed();
  // The lay-mode setting (hold / toggle) for NEST's LAY EGG (Story 1.22).
  const layMode = computed(() => platform.settings.settings.value.layMode);

  // After 3 failed ticks (Story 1.17): keep the last good snapshot as THE save
  // (stop autosave, write it now, and every later save writes it too), then
  // offer EXPORT SAVE and RELOAD.
  // EXPORT SAVE (the save-failed sheet, Story 2.2): the game as it is now, as a file.
  const exportSave = (): void => {
    const state = haltedSnapshot ?? gameState.value;
    const text = saveManager.serialize(state, state.stats.playTimeMs);
    if (!platform.browser.download('the-swarm-save.json', text)) log.warn('save', 'export download failed');
  };

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

  // The settings screen (Story 1.27): from the resource sheet's [ SETTINGS ⚙ ] and from LOG.
  // It writes the settings store directly; EXPORT DIAGNOSTICS downloads a file built here.
  const exportDiagnostics = (): void => {
    const state = haltedSnapshot ?? gameState.value;
    const text = buildDiagnostics({
      build: BUILD_ID,
      now: Date.now(),
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      save: saveManager.serialize(state, state.stats.playTimeMs),
      unreadableSave: saveManager.unreadableText(),
      seed: state.seed,
      settings: platform.settings.settings.value,
      capabilities: platform.capabilities,
      log: log.entries(),
    });
    if (!platform.browser.download(DIAGNOSTICS_FILENAME, text)) log.warn('diagnostics', 'export download failed');
  };
  const openSettingsScreen = (): void => {
    openSettings(sheets, {
      store: platform.settings,
      capabilities: platform.capabilities,
      onExportDiagnostics: exportDiagnostics,
    });
  };

  // The tab shell (Story 1.15): tabs revealed by phase, `•` from what became affordable.
  // A latched goal (Story 1.19): `•` on NEST and CONTINUE as its primary action.
  // Desktop (Story 1.29): from 1024 px the shell lays NEST and the active tab out as columns.
  const shell = createTabShell({
    phase: selectPhase,
    affordable: selectAffordableKeys,
    goalMet: selectGoalMet,
    wide: platform.viewport.wide,
  });
  // The rail's key hints: the keys bound to tabs 1–5, none while shortcuts are off.
  const tabKeys = computed<readonly string[]>(() => {
    const s = platform.settings.settings.value;
    if (!s.keyboardShortcuts) return [];
    const k = s.keyBindings;
    return [k.tab1, k.tab2, k.tab3, k.tab4, k.tab5];
  });
  // FRONT → WAR (Story 1.25): the enemy on the card and the battle replay, shared by the
  // enemy card and FIGHT; the summary opens at battle priority when the replay ends.
  const war = createWarSession({
    actions,
    onBattleDone: (result, enemy) => {
      announcer.announce(battleLine(result, enemy.name));
      openBattleSummary(sheets, result, enemy.name);
    },
  });
  // Tapping an event line that points at something opens its tab and scrolls to it (Story 1.26).
  const jump = createLineJump({
    phase: () => selectPhase.peek(),
    select: (tab) => shell.select(tab),
    selectSegment: (segment) => shell.selectSegment(segment),
    element: (panelId) => document.querySelector<HTMLElement>(`[data-panel="${panelId}"]`),
  });

  // The colony's event lines, written into the chronicle from game events (Story 1.26). It draws
  // nothing: NEST and LOG are views of the chronicle (Story 1.36).
  new EventLog(bus, { chronicle });

  // Pause (the top bar's button and the P shortcut, Story 1.30): the loop and the state flag together.
  const togglePause = (): void => {
    if (gameState.value.paused) loop.resume();
    else loop.pause();
    actions.togglePause();
  };
  // The paused look (main.css `.game-paused`) follows the state.
  effect(() => {
    document.body.classList.toggle('game-paused', selectPaused.value);
  });

  // Panels appear as their phase reveals them and stay for the session (Story 1.36, replacing
  // UIRoot's lazy panels). Each reveal is announced: the event log writes a panel's first line.
  const panels = createPanelReveal({ onReveal: (panelId) => bus.emit('panel_revealed', { panelId }) });
  // Reveal the current phase's panels before the first render, so they draw at once.
  phaseContent.onPhaseEnter(currentPhase as Phase, panels);

  // Every panel of the game, placed by the tab registry (data/content/tabs.ts).
  const views = gameViews({
    bus,
    getState: () => gameState.value,
    actions,
    // Irreversible actions read the confirm style and hold duration from the settings (Story 1.13).
    confirmSettings: platform.settings.settings,
    // The resource strip and resource sheet (Story 1.16) share one sampled feed (ADR 0012).
    feed: resourceFeed,
    sheets,
    onOpenSettings: openSettingsScreen,
    onTogglePause: togglePause,
    layMode,
    war,
    segment: shell.segment,
    chronicle,
    jump,
    saveFailing,
    onExportSave: exportSave,
  });
  if (app) {
    render(
      <App
        views={views}
        panels={panels}
        shell={shell}
        sheets={sheets}
        overlays={overlays}
        toasts={toasts}
        announcer={announcer}
        onContinue={actions.continuePhase}
        tabKeys={tabKeys}
      />,
      app,
    );
  }

  // ── The debug overlay (Story 1.34, AR24): dev builds and `?debug=1`, in its own chunk ──
  // Backtick or a 3-finger long-press toggles it. Read-only; EXPORT DIAGNOSTICS is the settings export.
  if (debugEnabled({ dev: import.meta.env.DEV, search: typeof location === 'undefined' ? '' : location.search })) {
    void import('./debug/overlay')
      .then(({ mountDebugOverlay }) =>
        mountDebugOverlay({
          state: gameState,
          ticks: tickTimings,
          catchUpMs,
          saveVersion: SaveManager.SAVE_VERSION,
          build: BUILD_ID,
          onExportDiagnostics: exportDiagnostics,
        }),
      )
      .catch((e: unknown) => log.warn('debug', 'debug overlay failed to load', e));
  }
  // ── Cheats (Story 1.34): DEV BUILDS ONLY. The bundler drops this branch, and the chunk, from production. ──
  const cheatsLoaded: Promise<Cheats> | null = import.meta.env.DEV
    ? import('./debug/cheats').then(({ createCheats }) =>
        createCheats({
          read: () => gameState.value,
          write: (next) => {
            gameState.value = next;
          },
          bus,
          fsm,
          catchUp: (state, ms) => catchUp(state, ms, Math.floor(ms / 50), catchUpDeps),
        }),
      )
    : null;

  // ── Keyboard shortcuts (Story 1.30): primary action, tabs, pause, close; on/off and remaps from settings ──
  bindShortcuts({
    settings: platform.settings.settings,
    sheets,
    overlayHeld: overlays.held,
    pause: togglePause,
  });
  // What hover shows, a tap shows; tips stay hoverable and Esc dismisses them (WCAG 1.4.13).
  bindTips();

  // Start onboarding tutorial for new players (the intro flag lives in platform/, outside the save)
  setTimeout(() => {
    const onboarding = new OnboardingManager({ flag: platform.introFlag, hasSave: opened.status !== 'empty' });
    onboarding.start();
  }, 500);

  // Ensure body class persists (some environments may clear it during boot)
  requestAnimationFrame(() => {
    const bodyClass = PhaseContent.getPhaseBodyClass(currentPhase as Phase);
    if (bodyClass && !document.body.classList.contains(bodyClass)) {
      document.body.classList.add(bodyClass);
    }
  });

  // A committed phase reveals its panels at once, under the phase reveal (Story 1.20).
  bus.subscribe('phase_committed', ({ to }) => {
    phaseContent.onPhaseEnter(to, panels);
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
  uiReady = true;

  // A cold load resumes once, from the save's lastSeenAt, AFTER the UI and its listeners
  // are bound: a goal the catch-up latches is then seen and announced like any other
  // (Story 1.32). An unreadable save waits behind its sheet with a fresh state: nothing to resume.
  if (opened.status !== 'unreadable') resumePath.coldStart(saved?.lastSeenAt ?? null);

  // Start autosave
  saveManager.startAutosave(() => ({
    state: gameState.value,
    playTimeMs: gameState.value.stats.playTimeMs,
  }));

  // Hidden and back (Story 2.3, D1): hiding saves with lastSeenAt and stops the ticker;
  // every return signal goes to the one resume path, which applies the gap once.
  platform.lifecycle.bind({ hidden: () => resumePath.hide(), returned: () => resumePath.show() });
  // A visible frame gap over 1 s (a stall, a throttled tab) is resumed, not dropped.
  ticker.onGap((gapMs) => resumePath.frameGap(gapMs));

  // beforeunload is a fallback save only (D1): pagehide/visibilitychange save first.
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

  // A save that couldn't be read (Story 2.2): the game waits behind the sheet, writing
  // nothing, until the player chooses. LOAD BACKUP makes the backup the save and boots
  // from it; START OVER writes the fresh run and starts it.
  if (opened.status === 'unreadable') {
    const backup = opened.backup;
    const sheetId = openUnreadableSave(sheets, {
      hasBackup: backup !== undefined,
      confirmSettings: platform.settings.settings,
      onLoadBackup: () => {
        if (backup && saveManager.loadBackup(backup.slot)) platform.browser.reload();
      },
      onStartOver: () => {
        log.info('save', 'unreadable save set aside; starting over');
        saveManager.startOver(gameState.value, gameState.value.stats.playTimeMs);
        sheets.close(sheetId);
        loop.start();
      },
    });
  } else {
    loop.start();
  }

  return { bus, ticker, tick, loop, resourceSystem, saveManager, fsm, panels, audio, actions, platform, sheets, overlays, chronicle, toasts, cheatsLoaded };
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
  // Dev builds: `window.__swarm.cheats` (addResources, setPhase, timeSkip, setSeed), once loaded.
  void swarm.cheatsLoaded?.then((cheats) => {
    (swarm as Record<string, unknown>).cheats = cheats;
  });
}
