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
import { processTick } from './engine/processTick';
import { catchUp, type CatchUpDeps } from './engine/catchUp';
import { createResumePath, resume } from './engine/resume';
import { render } from 'preact';
import { computed, effect, signal } from '@preact/signals-core';
import { App } from './ui/App';
import { gameViews } from './ui/gameViews';
import { EventLog } from './ui/log/EventLog';
import { createPanelReveal, type PanelReveal } from './ui/shell/panelReveal';
import { createTabShell } from './ui/shell/tabShell';
import { selectAffordableKeys, selectCanChoose, selectCapacityReached, selectGoalMet, selectStarving, selectLifetime, selectOpenDecision, selectPhase } from './state/selectors';
import { AudioSystem } from './ui/AudioSystem';
import { SaveManager } from './persistence/SaveManager';
import { openOfflineSummary, type OfflineSummary } from './ui/sheets/OfflineSummarySheet';
import { decisionsAvailable, getReturnMove, itemPanel } from './systems/NextAction';
import { battleAdvice } from './systems/Counters';
import { createTelemetry, TELEMETRY_FILENAME, type Telemetry } from './state/telemetry';
import { bindDecisionSheets, type DecisionSheets } from './ui/sheets/DecisionSheet';
import { createToasts, type Toasts } from './ui/primitives/Toast';
import { openTickFailure } from './ui/sheets/TickFailureSheet';
import { openSettings } from './ui/sheets/SettingsSheet';
import { openImportConfirm, openImportRefused } from './ui/sheets/ImportSaveSheet';
import { buildDiagnostics, DIAGNOSTICS_FILENAME } from './debug/diagnostics';
import { createTickTimings } from './debug/timings';
import { debugEnabled } from './debug/enabled';
import type { Cheats } from './debug/cheats';
import { randomSeed } from './state/seed';
import { rngFromSeed } from './utils/rng';
import { createSheetController, type SheetController } from './ui/shell/SheetController';
import { bindShortcuts } from './ui/shell/shortcuts';
import { bindTips } from './ui/shell/tips';
import { createResourceFeed } from './ui/shell/resourceFeed';
import { createOverlayController, type OverlayController } from './ui/shell/OverlayController';
import { bindPausedOverlay } from './ui/overlays/PausedOverlay';
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
import { bindAnnouncements, battleLine, IMPORT_FAILED_LINE, SAVE_FAILED_LINE, SAVE_RECOVERED_LINE, UPDATE_READY_LINE } from './ui/shell/announcements';
import { SaveFailedMarker } from './ui/shell/SaveFailedMarker';
import { openUnreadableSave } from './ui/sheets/UnreadableSaveSheet';
import { openHomeScreenHint } from './ui/sheets/HomeScreenHintSheet';
import { bindDurability } from './persistence/durability';
import { createWebPlatform, type Platform } from './platform';
import { serviceWorkerWanted } from './platform/serviceWorker';
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
  /** Local play telemetry (Story 3.10): beside the game, outside the save, exported only by the player. */
  telemetry: Telemetry;
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
  let offlineSummary: OfflineSummary | null = null;
  // The event lines (Story 1.26, ADR 0018): kept beside the game state, written into every save.
  const chronicle = createChronicle(saved?.chronicle);
  saveManager.setChronicleSource(() => chronicle.snapshot());

  if (!saved) {
    // A new game draws its seed (Story 1.34, D6); a loaded one keeps the seed in its save.
    const seed = randomSeed(Math.random);
    gameState.value = { ...gameState.value, seed, rng: rngFromSeed(seed) };
  }
  if (saved) {
    // Pause is in-session only (Story 2.10, ADR 0002): it is never in the save, so the game always reopens running.
    gameState.value = saved.gameState;
    log.info('offline', `Save loaded. lastSeenAt: ${saved.lastSeenAt ?? 'null'}`);
  }

  // Play telemetry (Story 3.10, FR38, NFR10, ADR 0035): a ring buffer under its own key, outside
  // the save. Check-ins follow the lifecycle (arrival → hide), phases follow the committed phase.
  // It never leaves the device except as the file EXPORT TELEMETRY downloads.
  const telemetry = createTelemetry({ storage: platform.telemetry, now: () => Date.now(), phase: gameState.value.phase });
  const arriveForTelemetry = (): void => {
    const s = gameState.peek();
    telemetry.beginCheckIn({ phase: s.phase, decisionsAvailable: decisionsAvailable(s) });
  };

  // ── The one way back (Story 2.3, D1, ADR 0002) ──
  // Cold load, tab return, bfcache pageshow, focus after sleep and long frames all
  // call resume(elapsedMs) through this path. Under 60 s: full efficiency, no sheet.
  // 60 s or more: the offline path and its summary.
  let uiReady = false;
  // The pause (Story 2.10): session state the resume path owns; hiding the page ends it.
  const paused = signal(false);
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
      // Under 60 s (UX-DR43): no sheet; the strip's deltas flash once (Story 2.9).
      if (!info) {
        if (uiReady && result.elapsedMs > 0) resourceFeed.flash();
        return;
      }
      log.info('offline', `Ticks to simulate: ${info.offlineTicks} Elapsed: ${info.elapsedMs} Efficiency: ${info.efficiency}`);
      log.info('offline', `caught up in ${catchUpMs} ms`);
      bus.emit('offline_progress', {
        elapsedMs: info.elapsedMs,
        offlineTicks: info.offlineTicks,
        efficiency: info.efficiency,
        resourcesBefore: before.resources,
        resourcesAfter: result.state.resources,
      });
      // The summary (Story 2.9): built from the before/after states, with the next move
      // from the next-action rule. It opens once the UI is mounted (below), ahead of any decision sheet.
      const summary: OfflineSummary = {
        info,
        before: { resources: before.resources, combatResources: before.combatResources },
        after: { resources: result.state.resources, combatResources: result.state.combatResources },
        move: getReturnMove(result.state),
      };
      if (uiReady) showOfflineSummary(summary);
      else offlineSummary = summary;
    },
    onPausedChange: (p) => {
      paused.value = p;
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
    const { dtSec, events } = ctx;
    sessionMs += Math.round(dtSec * 1000);

    // Every system, through the one simulation step offline catch-up runs too (Story 2.5).
    // Every random draw of the tick comes from ctx.rng, the stream of state.rng (Story 3.1).
    let newState = processTick(state, resourceSystem, soldierSystem, mapSystem, territorySystem, events, dtSec, false, ctx.rng);

    // Decision events (Story 1.28, D8): spawn on the session clock, count down on game
    // time only while the sheet is on screen, time out through applyChoice.
    newState = tickDecisions(newState, {
      sessionMs,
      dtMs: Math.round(dtSec * 1000),
      shown: decisionSheets?.shown() ?? false,
      canSpawn: decisionGate(),
      timers: platform.settings.settings.peek().decisionTimers,
      rand: () => ctx.rng.float(),
      events,
    });

    // The phase never changes in a tick (Story 1.19, D3): a met goal only
    // latches. The player commits it with CONTINUE (actions.continuePhase).
    newState = fsm.latch(newState);

    // The tick's draws end up in its one write (Story 3.1).
    return newState.rng === ctx.rng.state ? newState : { ...newState, rng: ctx.rng.state };
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

  // The settings screen (Story 1.27): from the resource sheet's [ SETTINGS gear ] and from LOG.
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
      storage: platform.durability.status(),
      log: log.entries(),
    });
    if (!platform.browser.download(DIAGNOSTICS_FILENAME, text)) log.warn('diagnostics', 'export download failed');
  };
  // IMPORT SAVE (Story 2.11, AR6): pick a file, then SaveManager says what it is. A file that
  // isn't a swarm save (or is from a newer build) is refused and nothing changes. A valid one,
  // already migrated to this version, needs a hold-to-confirm; then it becomes THE save (every
  // later save is held, so this session can't overwrite it), its chronicle is loaded, and the
  // page reloads into it, so panels, phase and session state are rebuilt from the save.
  let settingsSheetId: number | null = null;
  const importSave = (): void => {
    void platform.browser.pickFile('.json,application/json').then((text) => {
      if (text === null) return;
      const read = saveManager.readImport(text);
      if (settingsSheetId !== null) sheets.close(settingsSheetId);
      settingsSheetId = null;
      if (!read.ok) {
        openImportRefused(sheets, { reason: read.reason, version: read.version, current: SaveManager.SAVE_VERSION });
        return;
      }
      const confirmId = openImportConfirm(sheets, {
        playTimeMs: read.save.playTimeMs,
        confirmSettings: platform.settings.settings,
        onConfirm: () => {
          sheets.close(confirmId);
          if (!saveManager.replaceWith(read.save)) {
            toasts.show(IMPORT_FAILED_LINE);
            return;
          }
          log.info('save', 'save imported; reloading into it');
          chronicle.load(read.save.chronicle);
          loop.stop();
          platform.browser.reload();
        },
      });
    });
  };
  // EXPORT TELEMETRY (Story 3.10): the local ring buffer as a file; nothing is ever sent.
  const exportTelemetry = (): void => {
    if (!platform.browser.download(TELEMETRY_FILENAME, telemetry.exportText({ build: BUILD_ID }))) log.warn('telemetry', 'export download failed');
  };
  const openSettingsScreen = (): void => {
    settingsSheetId = openSettings(sheets, {
      store: platform.settings,
      capabilities: platform.capabilities,
      onExportDiagnostics: exportDiagnostics,
      onPause: () => resumePath.pause(),
      onExportSave: exportSave,
      onImportSave: importSave,
      onExportTelemetry: exportTelemetry,
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
      // Story 4.3: the cause's counter card, read from the state after the battle; CHANGE opens it on WAR.
      openBattleSummary(sheets, result, enemy.name, {
        advice: battleAdvice(result.cause, gameState.peek()),
        onChange: (card) => jump.jump(itemPanel(card.ref), `[data-card="${card.ref.kind}-${'id' in card.ref ? card.ref.id : ''}"]`),
      });
    },
  });
  // Tapping an event line that points at something opens its tab and scrolls to it (Story 1.26).
  const jump = createLineJump({
    phase: () => selectPhase.peek(),
    select: (tab) => shell.select(tab),
    selectSegment: (segment) => shell.selectSegment(segment),
    element: (panelId) => document.querySelector<HTMLElement>(`[data-panel="${panelId}"]`),
  });

  // The offline summary's next move opens its target's tab and marks the panel (Story 2.9,
  // UX-DR24), the way a chronicle line jumps. On NEST in Phase 1, closing the sheet is enough.
  function showOfflineSummary(summary: OfflineSummary): void {
    openOfflineSummary(sheets, summary, { onMove: (move) => move.kind === 'act' && jump.jump(move.panel) });
  }

  // The colony's event lines, written into the chronicle from game events (Story 1.26). It draws
  // nothing: NEST and LOG are views of the chronicle (Story 1.36).
  new EventLog(bus, { chronicle });

  // Pause (the top bar's button, the P shortcut and PAUSE in settings; Story 2.10): in-session
  // only, owned by the resume path, which stops the ticker and ends the pause when the page hides.
  const togglePause = (): void => {
    if (resumePath.isPaused()) resumePath.unpause();
    else resumePath.pause();
  };
  // The PAUSED overlay line while paused; the next tap or key resumes.
  bindPausedOverlay({ paused, overlays, unpause: () => resumePath.unpause() });
  // The paused look (main.css `.game-paused`) follows the pause.
  effect(() => {
    document.body.classList.toggle('game-paused', paused.value);
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
    paused,
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
    telemetry.phase(to);
  });
  // A prestige starts the run over: telemetry closes the phase it left (Story 3.10).
  bus.subscribe('prestige_triggered', () => telemetry.phase(gameState.peek().phase));

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
  if (offlineSummary) showOfflineSummary(offlineSummary);
  uiReady = true;

  // Durability (Story 2.12, D4): at the first meaningful play (the first committed phase,
  // or a load already past it) ask for persistent storage once and log the answer; on a
  // mobile browser that isn't the installed app, show the add-to-home-screen hint once.
  // Bound after the offline summary, so the hint waits behind it.
  bindDurability({
    bus,
    phase: () => gameState.peek().phase,
    durability: platform.durability,
    openHint: () => void openHomeScreenHint(sheets),
  });

  // A cold load resumes once, from the save's lastSeenAt, AFTER the UI and its listeners
  // are bound: a goal the catch-up latches is then seen and announced like any other
  // (Story 1.32). An unreadable save waits behind its sheet with a fresh state: nothing to resume.
  if (opened.status !== 'unreadable') resumePath.coldStart(saved?.lastSeenAt ?? null);
  // The first check-in starts on arrival, after the cold-start catch-up: its decisions are the ones on screen.
  arriveForTelemetry();

  // Start autosave
  saveManager.startAutosave(() => ({
    state: gameState.value,
    playTimeMs: gameState.value.stats.playTimeMs,
  }));

  // Hidden and back (Story 2.3, D1): hiding saves with lastSeenAt and stops the ticker;
  // every return signal goes to the one resume path, which applies the gap once.
  // A return also asks for a new version (Story 2.13): a PWA left open for days never navigates.
  // Notifications (Story 2.14, D9) ride the same signals: once the player is back, any
  // reminder still pending is stale. The web service is a no-op; a store build schedules
  // reminders at predicted times on hide. Only main holds the service: no game outcome
  // depends on it.
  platform.lifecycle.bind({
    hidden: () => {
      resumePath.hide();
      telemetry.endCheckIn();
    },
    returned: () => {
      platform.notifications.cancelAll();
      resumePath.show();
      // A return burst (visible + pageshow + focus) opens one check-in; telemetry ignores the rest.
      arriveForTelemetry();
      void platform.serviceWorker.checkForUpdate();
    },
  });
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

  // Offline play (Story 2.13, D10): the service worker precaches the game. Production builds
  // only (dev and E2E builds with `?sw=1`), so the dev server never runs a worker. A new
  // version waits for the next cold start; the player is told once, and never reloaded.
  void platform.serviceWorker.register({
    enabled: serviceWorkerWanted({ prod: import.meta.env.PROD, search: typeof location === 'undefined' ? '' : location.search }),
    url: `${import.meta.env.BASE_URL}sw.js`,
    scope: import.meta.env.BASE_URL,
    onUpdateReady: () => toasts.show(UPDATE_READY_LINE),
    onError: (error) => log.warn('pwa', 'service worker registration failed; offline play is off', error),
  });

  return { bus, ticker, tick, loop, resourceSystem, saveManager, fsm, panels, audio, actions, platform, sheets, overlays, chronicle, toasts, telemetry, cheatsLoaded };
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
