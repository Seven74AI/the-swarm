import type { EventBus } from '../engine/EventBus';
import type { SaveManager } from '../persistence/SaveManager';
import type { GameState } from '../state/GameState';
import type { GameLoop } from '../engine/GameLoop';
import { EventLog } from './panels/EventLog';
import { ExpeditionPanel } from './panels/ExpeditionPanel';
import { ExplorationPanel } from './panels/ExplorationPanel';
import { MapPanel } from './panels/MapPanel';
import { SpaceshipPanel } from './panels/SpaceshipPanel';
import { CosmicPanel } from './panels/CosmicPanel';
import { StarmapPanel } from './panels/StarmapPanel';
import { PrestigePanel } from './panels/PrestigePanel';
import { PrestigeTreePanel } from './panels/PrestigeTreePanel';
import { TranscendencePanel } from './panels/TranscendencePanel';
import { FoodDisplay } from './panels/FoodDisplay';
import type { AudioSystem } from './AudioSystem';
import type { Actions } from '../actions';
import { explain } from './components/refusal';
import type { ReadonlySignal } from '@preact/signals-core';
import type { ConfirmSettings } from './primitives/HoldToConfirm';
import type { ShellHosts } from './shell/hosts';
import { PANEL_PLACEMENT, placementOf } from '../data/content/tabs';
import type { Chronicle } from '../state/chronicle';
import type { LineJump } from './log/jump';

/** Where main renders NEST's Preact parts (Story 1.22). */
export interface NestMounts {
  /** The primary action, in NEST's primary zone. */
  primary(host: HTMLElement): void;
  /** The scene area, under the phase line. */
  scene(host: HTMLElement): void;
  /** The Click Power card, under the event lines. */
  clickPower(host: HTMLElement): void;
}

/** Where main renders WRKR's Preact parts (Story 1.23). */
export interface WorkersMounts {
  /** The upkeep readout and role rows, in `#worker-assignment`. */
  tab(host: HTMLElement): void;
  /** The primary action (the reallocation), in WRKR's primary zone. */
  primary(host: HTMLElement): void;
  /** The automation section, in the `automation_panel` host. */
  automation(host: HTMLElement): void;
}

/** Where main renders FRONT → WAR's Preact parts (Story 1.25). */
export interface WarMounts {
  /** Soldiers, training and equipment, in `#soldier-panel`. */
  soldiers(host: HTMLElement): void;
  /** The mutation cards, in `#mutation-panel`. */
  mutations(host: HTMLElement): void;
  /** The enemy card, in `#battle-panel`. */
  enemy(host: HTMLElement): void;
  /** The combat log, in `#combat-log-panel`. */
  log(host: HTMLElement): void;
  /** `> FIGHT`, in FRONT's primary zone. */
  primary(host: HTMLElement): void;
}

/** Where main renders BUILD's Preact parts (Story 1.24), top to bottom, then the primary action. */
export interface BuildMounts {
  /** `BUILD` or `NEXT: <item> IN ~<time>`. */
  header(host: HTMLElement): void;
  /** The Click Power card (from Phase 2). */
  clickPower(host: HTMLElement): void;
  /** The building cards, into `#building-panel`. */
  buildings(host: HTMLElement): void;
  /** The research chain, into `#research-panel`. */
  research(host: HTMLElement): void;
  /** The converter card, into `#resource-converter-panel`. */
  converter(host: HTMLElement): void;
  /** `> BUY` on the highlighted card, in BUILD's primary zone. */
  primary(host: HTMLElement): void;
}

/** Where main renders LOG's Preact parts (Story 1.26), top to bottom. */
export interface LogMounts {
  /** The full event log. */
  chronicle(host: HTMLElement): void;
  /** Lifetime stats. */
  stats(host: HTMLElement): void;
  /** The settings entry. */
  settings(host: HTMLElement): void;
  /** LEGACY, hosting the legacy prestige panels (`#prestige-panel`, the Legacy tree). */
  legacy(host: HTMLElement, panels: readonly HTMLElement[]): void;
}

/**
 * Root UI controller. Mounts all panels into #app.
 * State flows through @preact/signals-core; panels read it through state/selectors.
 * Phase 2+ panels use lazy creation via createPanel() for progressive unfolding.
 */
export class UIRoot {
  private bus: EventBus;
  /** Every player intent; panels call these instead of writing state (Story 1.6). */
  private actions: Actions;
  private saveManager: SaveManager;
  private getState: () => GameState;
  private eventLog: EventLog;
  private panelElements: Map<string, HTMLElement> = new Map();
  /** Decision popup (bottom-right, non-blocking) */

  /** Audio system for sound effects */
  private audio: AudioSystem | undefined;

  /** Game loop for pause/resume control */
  private loop: GameLoop;
  /** Confirm style and hold duration for irreversible actions (platform settings, from main). */
  private confirmSettings: ReadonlySignal<ConfirmSettings>;

  /** Container div (#panels) where panels without a shell host are appended. */
  private panelsContainer: HTMLElement | null = null;
  /** The tab shell's host containers (Story 1.15); each panel mounts in its tab's host. */
  private hosts: ShellHosts | null = null;

  /** Pause button reference for icon update on keyboard toggle. */
  private pauseBtnEl: HTMLButtonElement | null = null;

  /** Draws the resource strip into its host (Story 1.16; main renders the Preact strip there). */
  private mountStrip?: (host: HTMLElement) => void;
  private mountPhaseLine?: (host: HTMLElement) => void;
  private mountNest?: NestMounts;
  private mountWorkers?: WorkersMounts;
  private mountBuild?: BuildMounts;
  private mountWar?: WarMounts;
  private mountLog?: LogMounts;

  /** Registry mapping panelId → factory function. Populated in constructor. */
  private panelRegistry: Map<string, () => HTMLElement> = new Map();

  constructor(deps: {
    bus: EventBus;
    actions: Actions;
    saveManager: SaveManager;
    getState: () => GameState;
    audio?: AudioSystem;
    loop: GameLoop;
    /** The platform settings signal (or its confirm slice), passed in by main (Story 1.13). */
    confirmSettings: ReadonlySignal<ConfirmSettings>;
    /** Renders the resource strip and its sheet into the `resource_panel` host (Story 1.16). */
    mountStrip?: (host: HTMLElement) => void;
    /** Renders the phase line and goal meter into NEST's `#phase-indicator` host (Story 1.18). */
    mountPhaseLine?: (host: HTMLElement) => void;
    /** Renders NEST's primary action, scene area and Click Power card into their hosts (Story 1.22). */
    mountNest?: NestMounts;
    /** Renders WRKR's role rows and upkeep, its primary action and automation into their hosts (Story 1.23). */
    mountWorkers?: WorkersMounts;
    /** Renders BUILD's header, cards and primary action into their hosts (Story 1.24). */
    mountBuild?: BuildMounts;
    /** Renders FRONT → WAR: soldiers, mutations, the enemy card, the combat log and FIGHT (Story 1.25). */
    mountWar?: WarMounts;
    /** Renders LOG's chronicle, lifetime stats, settings entry and LEGACY into their hosts (Story 1.26). */
    mountLog?: LogMounts;
    /** The event lines, saved with the game (Story 1.26); default: a new chronicle. */
    chronicle?: Chronicle;
    /** Tapping an event line that points at something jumps to it (Story 1.26). */
    jump?: LineJump;
  }) {
    this.bus = deps.bus;
    this.actions = deps.actions;
    this.saveManager = deps.saveManager;
    this.getState = deps.getState;
    this.eventLog = new EventLog(this.bus, { chronicle: deps.chronicle, jump: deps.jump });
    this.audio = deps.audio;
    this.loop = deps.loop;
    this.confirmSettings = deps.confirmSettings;
    this.mountStrip = deps.mountStrip;
    this.mountPhaseLine = deps.mountPhaseLine;
    this.mountNest = deps.mountNest;
    this.mountWorkers = deps.mountWorkers;
    this.mountBuild = deps.mountBuild;
    this.mountWar = deps.mountWar;
    this.mountLog = deps.mountLog;

    // ── Populate panel registry with factory functions ──
    // Phase 1 panels (mounted at boot for always-visible UI)
    this.panelRegistry.set('resource_panel', () => this.createStripHost());
    this.panelRegistry.set('phase_indicator', () => this.createPhaseLineHost());
    this.panelRegistry.set('click_button', () => this.createNestPrimaryHost());
    this.panelRegistry.set('event_log', () => {
      const el = this.eventLog.getElement();
      el.id = 'activity-log';
      return el;
    });

    // Phase 2 panels (lazy — created on demand when colony phase is entered)
    // WRKR (Story 1.23): Preact role rows, upkeep and primary action; the hosts keep the legacy ids.
    this.panelRegistry.set('worker_assignment', () =>
      this.createHost('worker-assignment', 'panel worker-assignment-panel', (h) => this.mountWorkers?.tab(h)));
    this.panelRegistry.set('wrkr_primary', () => {
      const host = this.createHost('', '', (h) => this.mountWorkers?.primary(h));
      host.setAttribute('data-wrkr-primary', '');
      return host;
    });
    this.panelRegistry.set('food_display', () => new FoodDisplay().getElement());

    // Phase 3 panels (lazy — created on demand when combat/expansion phase is entered)
    // FRONT → WAR (Story 1.25): Preact sections; the hosts keep the legacy ids.
    this.panelRegistry.set('soldier_panel', () =>
      this.createHost('soldier-panel', 'panel soldier-panel', (h) => this.mountWar?.soldiers(h)));
    this.panelRegistry.set('mutation_panel', () =>
      this.createHost('mutation-panel', 'panel mutation-panel', (h) => this.mountWar?.mutations(h)));
    this.panelRegistry.set('battle_panel', () =>
      this.createHost('battle-panel', 'panel battle-panel', (h) => this.mountWar?.enemy(h)));
    this.panelRegistry.set('combat_log', () =>
      this.createHost('combat-log-panel', 'panel combat-log-panel', (h) => this.mountWar?.log(h)));
    this.panelRegistry.set('war_primary', () => {
      const host = this.createHost('', '', (h) => this.mountWar?.primary(h));
      host.setAttribute('data-war-primary-host', '');
      return host;
    });
    this.panelRegistry.set('expedition_panel', () => new ExpeditionPanel(
      this.bus, this.getState, this.actions,
    ).getElement());
    this.panelRegistry.set('map_panel', () => {
      const mapPanel = new MapPanel(this.getState);
      mapPanel.onTileClick = (x: number, y: number) => {
        explain(mapPanel.getElement(), this.actions.claimTile(x, y));
      };
      return mapPanel.getElement();
    });

    // Phase 4 panels (lazy — created on demand)
    this.panelRegistry.set('spaceship_panel', () => new SpaceshipPanel(
      this.bus, this.getState, this.actions,
    ).getElement());
    this.panelRegistry.set('cosmic_panel', () => new CosmicPanel(
      this.bus, this.getState,
    ).getElement());
    this.panelRegistry.set('exploration_panel', () => new ExplorationPanel(
      this.bus, this.getState, this.actions,
    ).getElement());
    this.panelRegistry.set('starmap_panel', () => {
      const starmapPanel = new StarmapPanel(this.bus, this.getState);
      starmapPanel.onPlanetClick = (planet, discovered) => {
        if (discovered) {
          this.bus.emit('planet_clicked', {
            name: planet.name,
            type: planet.type,
            yields: planet.yields,
            accessibility: planet.accessibility,
          });
        } else {
          this.bus.emit('planet_clicked', {
            name: planet.name,
            type: planet.type,
            requirement: planet.requirement,
            discovered: false,
          });
        }
      };
      return starmapPanel.getElement();
    });

    // Phase 5 panels (lazy — created on demand)
    this.panelRegistry.set('automation_panel', () =>
      this.createHost('', 'panel automation-host', (h) => this.mountWorkers?.automation(h)));
    // LOG (Story 1.26): the prestige panels live in LOG → LEGACY; creating either creates LEGACY.
    this.panelRegistry.set('prestige_panel', () => this.legacyPanel('prestige_panel'));
    this.panelRegistry.set('prestige_tree_panel', () => this.legacyPanel('prestige_tree_panel'));
    this.panelRegistry.set('log_chronicle', () => this.createLogHost('chronicle', this.mountLog?.chronicle));
    this.panelRegistry.set('log_stats', () => this.createLogHost('stats', this.mountLog?.stats));
    this.panelRegistry.set('log_settings', () => this.createLogHost('settings', this.mountLog?.settings));
    this.panelRegistry.set('log_legacy', () => {
      // LEGACY is LOG's last section, whichever LOG panel is asked for first.
      for (const id of ['log_chronicle', 'log_stats', 'log_settings']) this.createPanel(id);
      const prestige = new PrestigePanel(this.bus, this.getState, this.actions, this.confirmSettings).getElement();
      const tree = new PrestigeTreePanel(this.bus, this.getState, this.actions).getElement();
      this.panelElements.set('prestige_panel', prestige);
      this.panelElements.set('prestige_tree_panel', tree);
      const host = document.createElement('div');
      host.setAttribute('data-log-host', 'legacy');
      if (this.mountLog) this.mountLog.legacy(host, [prestige, tree]);
      else host.append(prestige, tree);
      return host;
    });
    this.panelRegistry.set('transcendence_panel', () => new TranscendencePanel(
      this.bus, this.getState,
    ).getElement());

    // BUILD (Story 1.24): Preact cards in hosts that keep the legacy panels' ids.
    this.panelRegistry.set('build_header', () => this.createBuildHost('header', this.mountBuild?.header));
    this.panelRegistry.set('build_click_power', () => this.createBuildHost('click-power', this.mountBuild?.clickPower));
    this.panelRegistry.set('building_panel', () => this.createBuildPanel('building-panel', this.mountBuild?.buildings));
    this.panelRegistry.set('research_panel', () => this.createBuildPanel('research-panel', this.mountBuild?.research));
    this.panelRegistry.set('resource_converter_panel', () =>
      this.createBuildPanel('resource-converter-panel', this.mountBuild?.converter));
    this.panelRegistry.set('build_primary', () => {
      const host = document.createElement('div');
      host.className = 'build-primary-host';
      host.setAttribute('data-build-primary-host', '');
      this.mountBuild?.primary(host);
      return host;
    });
  }

  /**
   * Toggle pause state — used by the pause button and the pause shortcut
   * (P by default; `ui/shell/shortcuts.ts`, bound in main.tsx, Story 1.30).
   * Reads current state, calls loop.pause()/resume(), updates signal + UI.
   */
  togglePause(): void {
    const btn = this.pauseBtnEl;
    const state = this.getState();
    if (state.paused) {
      this.loop.resume();
      this.actions.togglePause();
      document.body.classList.remove('game-paused');
      if (btn) btn.textContent = '⏸';
    } else {
      this.loop.pause();
      this.actions.togglePause();
      document.body.classList.add('game-paused');
      if (btn) btn.textContent = '▶';
    }
  }

  /**
   * Mount the legacy panels into the tab shell (Story 1.15). Each panel goes
   * into the host of its placement in the tab registry (data/content/tabs.ts).
   */
  mount(hosts: ShellHosts): void {
    this.hosts = hosts;

    // Top bar
    const topBar = document.createElement('div');
    topBar.id = 'top-bar';
    topBar.className = 'top-bar';
    topBar.innerHTML =
      // The page's one h1 (Story 1.32); the ant is decoration.
      '<h1 class="game-title"><span aria-hidden="true">🐜 </span>THE SWARM</h1>';

    // Pause button between title and phase label
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'pause-button';
    pauseBtn.className = 'pause-btn';
    pauseBtn.setAttribute('aria-label', 'Pause game');
    pauseBtn.textContent = '⏸';
    pauseBtn.addEventListener('click', () => this.togglePause());
    this.pauseBtnEl = pauseBtn;
    topBar.appendChild(pauseBtn);

    const phaseLabel = document.createElement('span');
    phaseLabel.className = 'game-phase';
    phaseLabel.textContent = "Queen's Chamber";
    topBar.appendChild(phaseLabel);
    hosts.strip.appendChild(topBar);

    // Phase indicator (always visible) — boot panel (Phase 1), NEST
    const phaseLine = this.createPhaseLineHost();
    hosts.host(PANEL_PLACEMENT.phase_indicator).appendChild(phaseLine);
    this.panelElements.set('phase_indicator', phaseLine);

    // NEST, top to bottom (Story 1.22): phase line and goal meter (above),
    // the scene area, the event lines, then the Click Power card (Phase 1).
    hosts.host(PANEL_PLACEMENT.phase_indicator).appendChild(this.createNestHost('scene', this.mountNest?.scene));

    // Event lines — boot panel (Phase 1), NEST
    const logEl = this.eventLog.getElement();
    logEl.id = 'activity-log';
    hosts.host(PANEL_PLACEMENT.event_log).appendChild(logEl);
    this.panelElements.set('event_log', logEl);

    hosts.host(PANEL_PLACEMENT.phase_indicator).appendChild(this.createNestHost('click-power', this.mountNest?.clickPower));

    // NEST's primary action (LAY EGG in Phase 1, then the next action), pinned in the primary zone
    const primary = this.createNestPrimaryHost();
    hosts.host(PANEL_PLACEMENT.click_button).appendChild(primary);
    this.panelElements.set('click_button', primary);

    // The shell's scroll area is #panels.
    this.panelsContainer = hosts.scroll;

    // ── Phase 1 panels: mount at boot (always visible) — resources sit in the strip ──
    const stripHost = this.createStripHost();
    hosts.host(PANEL_PLACEMENT.resource_panel).appendChild(stripHost);
    this.panelElements.set('resource_panel', stripHost);

    // ── Phase 2+ panels are NOT mounted at boot ──
    // They are created lazily via createPanel() when their phase is entered.
    // This makes panel reveals feel like genuine new features and avoids
    // cluttering the DOM with disabled buttons from the first second.

    // Decision events open a decision sheet through the SheetController (main.tsx, Story 1.14).

    // The phase reveal is an overlay drawn by App (Story 1.20, ui/overlays/PhaseReveal);
    // main.tsx reveals the new phase's panels on phase_committed (PhaseContent.onPhaseEnter).

    // Listen for worker changes to trigger narrative events
    this.bus.subscribe('workers_changed', (payload: unknown) => {
      const p = payload as { workers: number };
      if (p.workers !== undefined) {
        this.eventLog.notifyWorkerCount(p.workers);
      }
    });

    // Listen for Prestige Tree open request from PrestigePanel button
    this.bus.subscribe('open_prestige_tree', () => {
      this.createPanel('prestige_tree_panel');
      this.showPanel('prestige_tree_panel');
    });

    // ── Phase 4+ panels are NOT mounted at boot ──
    // They are created lazily via createPanel() when their phase is entered.
    // This makes panel reveals feel like genuine new features.
  }

  /**
   * Lazily create and mount a panel by its ID.
   *
   * If the panel was already created (via a prior call or at boot), returns the
   * existing element immediately (idempotent). Otherwise instantiates the panel
   * via its factory, appends it to the #panels container, and stores it.
   *
   * Throws a descriptive error for unknown panel IDs.
   *
   * @param panelId  The panel identifier (e.g. 'spaceship_panel', 'starmap_panel').
   * @returns The panel's root HTMLElement.
   */
  createPanel(panelId: string): HTMLElement {
    // Return cached element if already created
    const existing = this.panelElements.get(panelId);
    if (existing) return existing;

    // Look up factory
    const factory = this.panelRegistry.get(panelId);
    if (!factory) {
      throw new Error(
        `Unknown panel "${panelId}". Check the panel ID against the registry.`,
      );
    }

    // Ensure panels container exists (may not exist if createPanel called before mount)
    let panelsEl = this.panelsContainer;
    if (!panelsEl) {
      panelsEl = document.getElementById('panels');
      if (!panelsEl) {
        panelsEl = document.createElement('div');
        panelsEl.id = 'panels';
        document.body.appendChild(panelsEl);
      }
      this.panelsContainer = panelsEl;
    }

    // Create and mount, in the panel's tab host when the shell is mounted
    const element = factory();
    // A factory that placed its panel itself (LOG → LEGACY) already registered it.
    const placed = this.panelElements.get(panelId);
    if (placed) return placed;
    const placement = placementOf(panelId);
    const host = this.hosts && placement ? this.hosts.host(placement) : panelsEl;
    host.appendChild(element);
    this.panelElements.set(panelId, element);

    return element;
  }

  /**
   * The `resource_panel` host: the resource strip and its sheet replace the
   * legacy ResourcePanel (Story 1.16). The `.resource-panel` class stays as a hook.
   */
  /** The phase line and goal meter host (Story 1.18), keeping PhaseIndicator's `#phase-indicator` hooks. */
  private createPhaseLineHost(): HTMLElement {
    const host = document.createElement('div');
    host.id = 'phase-indicator';
    host.className = 'phase-indicator';
    this.mountPhaseLine?.(host);
    return host;
  }

  /** NEST's primary-action host (`click_button`, Story 1.22): LAY EGG, then the next-action button. */
  private createNestPrimaryHost(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'nest-primary-host';
    host.setAttribute('data-nest-primary', '');
    this.mountNest?.primary(host);
    return host;
  }

  /** A NEST content host (`[data-nest-host=<name>]`) that main renders into. */
  private createNestHost(name: string, mount?: (host: HTMLElement) => void): HTMLElement {
    const host = document.createElement('div');
    host.setAttribute('data-nest-host', name);
    mount?.(host);
    return host;
  }

  /** A host div for a Preact-drawn panel (`id` empty for none), hidden until `showPanel`. */
  private createHost(id: string, className: string, mount?: (host: HTMLElement) => void): HTMLElement {
    const host = document.createElement('div');
    host.style.display = 'none';
    if (id) host.id = id;
    if (className) host.className = className;
    mount?.(host);
    return host;
  }

  /** A LOG content host (`[data-log-host=<name>]`) that main renders into (Story 1.26). */
  private createLogHost(name: string, mount?: (host: HTMLElement) => void): HTMLElement {
    const host = document.createElement('div');
    host.setAttribute('data-log-host', name);
    mount?.(host);
    return host;
  }

  /** A legacy prestige panel, created inside LOG → LEGACY (Story 1.26). */
  private legacyPanel(panelId: 'prestige_panel' | 'prestige_tree_panel'): HTMLElement {
    this.createPanel('log_legacy');
    return this.panelElements.get(panelId)!;
  }

  /** A created panel's element (for a jump from an event line, Story 1.26). */
  panelElement(panelId: string): HTMLElement | undefined {
    return this.panelElements.get(panelId);
  }

  /** A BUILD content host (`[data-build-host=<name>]`) that main renders into. */
  private createBuildHost(name: string, mount?: (host: HTMLElement) => void): HTMLElement {
    const host = document.createElement('div');
    host.setAttribute('data-build-host', name);
    mount?.(host);
    return host;
  }

  /** A BUILD section keeping a legacy panel's id and class (`#building-panel.building-panel`, …). */
  private createBuildPanel(id: string, mount?: (host: HTMLElement) => void): HTMLElement {
    const host = document.createElement('section');
    host.id = id;
    host.className = `build-section ${id}`;
    mount?.(host);
    return host;
  }

  private createStripHost(): HTMLElement {
    const host = document.createElement('div');
    host.className = 'resource-panel';
    host.setAttribute('data-resource-panel', '');
    this.mountStrip?.(host);
    return host;
  }

  /**
   * Reveal a panel by its ID. If the panel element exists, shows it.
   * Used by PhaseContent.onPhaseEnter to unlock panels as phases advance.
   *
   * @param panelId        The panel identifier (e.g. 'worker_assignment').
   * @param revealDelayMs  Optional stagger delay in milliseconds. Applied as
   *                       inline animation-delay before the reveal animation
   *                       triggers, so panels appear one-by-one during phase
   *                       transitions. Defaults to 0 (no stagger).
   */
  showPanel(panelId: string, revealDelayMs: number = 0): void {
    const el = this.panelElements.get(panelId);
    if (el) {
      // Remove legacy scroll-awaiting class if present
      el.classList.remove('panel-awaiting-reveal');
      el.style.display = '';
      el.classList.add('panel-unlocked');
      // Play the reveal once, where the player sees it. A CSS animation restarts each
      // time its element is shown again, so a class left in place replayed the slide-in
      // (with its stagger delay) on every tab switch, moving panels from under the
      // pointer. A panel unlocked in a hidden tab simply appears there.
      if (!el.closest('[hidden]')) {
        // Stagger delay so panels cascade in rather than appearing simultaneously.
        if (revealDelayMs > 0) el.style.animationDelay = `${revealDelayMs}ms`;
        el.classList.add('panel-revealed');
        const done = (e: AnimationEvent): void => {
          if (e.target !== el || e.animationName !== 'phaseReveal') return;
          el.removeEventListener('animationend', done);
          el.classList.remove('panel-revealed');
          el.style.animationDelay = '';
        };
        el.addEventListener('animationend', done);
      }
      this.bus.emit('panel_revealed', { panelId });
    }
  }
}
