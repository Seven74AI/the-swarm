import type { EventBus } from '../engine/EventBus';
import type { SaveManager } from '../persistence/SaveManager';
import type { GameState } from '../state/GameState';
import type { GameLoop } from '../engine/GameLoop';
import { ClickButton } from './components/ClickButton';
import { EventLog } from './panels/EventLog';
import { WorkerAssignment } from './panels/WorkerAssignment';
import { SoldierPanel } from './panels/SoldierPanel';
import { BattlePanel } from './panels/BattlePanel';
import { CombatLogPanel } from './panels/CombatLogPanel';
import { BuildingPanel } from './panels/BuildingPanel';
import { ExpeditionPanel } from './panels/ExpeditionPanel';
import { ExplorationPanel } from './panels/ExplorationPanel';
import { MapPanel } from './panels/MapPanel';
import { SpaceshipPanel } from './panels/SpaceshipPanel';
import { CosmicPanel } from './panels/CosmicPanel';
import { StarmapPanel } from './panels/StarmapPanel';
import { ResourceConverterPanel } from './panels/ResourceConverterPanel';
import { TechTreePanel } from './panels/TechTreePanel';
import { AutoProductionPanel } from './panels/AutoProductionPanel';
import { PrestigePanel } from './panels/PrestigePanel';
import { PrestigeTreePanel } from './panels/PrestigeTreePanel';
import { TranscendencePanel } from './panels/TranscendencePanel';
import { ResearchPanel } from './panels/ResearchPanel';
import { MutationPanel } from './panels/MutationPanel';
import { FoodDisplay } from './panels/FoodDisplay';
import type { AudioSystem } from './AudioSystem';
import type { Actions } from '../actions';
import { explain } from './components/refusal';
import type { ReadonlySignal } from '@preact/signals-core';
import type { ConfirmSettings } from './primitives/HoldToConfirm';
import type { ShellHosts } from './shell/hosts';
import { PANEL_PLACEMENT, placementOf } from '../data/content/tabs';

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
  private transitionOverlay: HTMLElement | null = null;
  /** Cleanup for transition skip handler (removed on endTransition). */
  private transitionCleanup: (() => void) | null = null;
  /** Promise resolve for waiting on transition end (set by startTransition, resolved by endTransition/skip). */
  private transitionResolve: (() => void) | null = null;
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
  }) {
    this.bus = deps.bus;
    this.actions = deps.actions;
    this.saveManager = deps.saveManager;
    this.getState = deps.getState;
    this.eventLog = new EventLog(this.bus);
    this.audio = deps.audio;
    this.loop = deps.loop;
    this.confirmSettings = deps.confirmSettings;
    this.mountStrip = deps.mountStrip;
    this.mountPhaseLine = deps.mountPhaseLine;

    // ── Populate panel registry with factory functions ──
    // Phase 1 panels (mounted at boot for always-visible UI)
    this.panelRegistry.set('resource_panel', () => this.createStripHost());
    this.panelRegistry.set('phase_indicator', () => this.createPhaseLineHost());
    this.panelRegistry.set('click_button', () => new ClickButton(
      this.bus, this.actions, this.saveManager, this.getState, deps.audio,
    ).getElement());
    this.panelRegistry.set('event_log', () => {
      const el = this.eventLog.getElement();
      el.id = 'activity-log';
      return el;
    });

    // Phase 2 panels (lazy — created on demand when colony phase is entered)
    this.panelRegistry.set('worker_assignment', () => new WorkerAssignment(
      this.bus, this.actions, this.getState,
    ).getElement());
    this.panelRegistry.set('food_display', () => new FoodDisplay().getElement());

    // Phase 3 panels (lazy — created on demand when combat/expansion phase is entered)
    this.panelRegistry.set('soldier_panel', () => new SoldierPanel(
      this.bus, this.actions, this.getState,
    ).getElement());
    this.panelRegistry.set('battle_panel', () => new BattlePanel(
      this.bus, this.actions, this.getState,
    ).getElement());
    this.panelRegistry.set('combat_log', () => new CombatLogPanel().getElement());
    this.panelRegistry.set('building_panel', () => new BuildingPanel(
      this.bus, this.getState, this.actions,
    ).getElement());
    this.panelRegistry.set('mutation_panel', () => new MutationPanel(
      this.bus, this.getState, this.actions,
    ).getElement());
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
    this.panelRegistry.set('resource_converter_panel', () => new ResourceConverterPanel(
      this.bus, this.getState, this.actions,
    ).getElement());

    // Phase 5 panels (lazy — created on demand)
    this.panelRegistry.set('tech_tree_panel', () => new TechTreePanel(
      this.bus, this.getState, this.actions,
    ).getElement());
    this.panelRegistry.set('automation_panel', () => new AutoProductionPanel(
      this.bus, this.getState, this.actions,
    ).getElement());
    this.panelRegistry.set('prestige_panel', () => new PrestigePanel(
      this.bus, this.getState, this.actions, this.confirmSettings,
    ).getElement());
    this.panelRegistry.set('prestige_tree_panel', () => new PrestigeTreePanel(
      this.bus, this.getState, this.actions,
    ).getElement());
    this.panelRegistry.set('transcendence_panel', () => new TranscendencePanel(
      this.bus, this.getState,
    ).getElement());

    // Phase 4+ research panel (lazy — created on demand)
    this.panelRegistry.set('research_panel', () => new ResearchPanel(
      this.bus, this.getState, this.actions, this.confirmSettings,
    ).getElement());
  }

  /**
   * Toggle pause state — used by both button click and Space keyboard shortcut.
   * Reads current state, calls loop.pause()/resume(), updates signal + UI.
   */
  private togglePause(): void {
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
      '<span class="game-title">🐜 THE SWARM</span>';

    // Pause button between title and phase label
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'pause-button';
    pauseBtn.className = 'pause-btn';
    pauseBtn.setAttribute('aria-label', 'Pause game');
    pauseBtn.textContent = '⏸';
    pauseBtn.addEventListener('click', () => this.togglePause());
    this.pauseBtnEl = pauseBtn;
    topBar.appendChild(pauseBtn);

    // Keyboard shortcut: Space toggles pause
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      // Ignore when focus is on an input or textarea
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      this.togglePause();
    });

    const phaseLabel = document.createElement('span');
    phaseLabel.className = 'game-phase';
    phaseLabel.textContent = "Queen's Chamber";
    topBar.appendChild(phaseLabel);
    hosts.strip.appendChild(topBar);

    // Phase indicator (always visible) — boot panel (Phase 1), NEST
    const phaseLine = this.createPhaseLineHost();
    hosts.host(PANEL_PLACEMENT.phase_indicator).appendChild(phaseLine);
    this.panelElements.set('phase_indicator', phaseLine);

    // Click button — NEST's primary action, pinned in the primary zone
    const clickBtn = new ClickButton(
      this.bus,
      this.actions,
      this.saveManager,
      this.getState,
      this.audio,
    );
    hosts.host(PANEL_PLACEMENT.click_button).appendChild(clickBtn.getElement());
    this.panelElements.set('click_button', clickBtn.getElement());

    // Activity log — boot panel (Phase 1), NEST
    const logEl = this.eventLog.getElement();
    logEl.id = 'activity-log';
    hosts.host(PANEL_PLACEMENT.event_log).appendChild(logEl);
    this.panelElements.set('event_log', logEl);

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

    // ── Phase transition overlay ──
    this.transitionOverlay = document.createElement('div');
    this.transitionOverlay.id = 'phase-transition-overlay';
    this.transitionOverlay.style.display = 'none';
    document.body.appendChild(this.transitionOverlay);

    // ── Transition events ──
    this.bus.subscribe('transition_start', (payload: unknown) => {
      const p = payload as { phase: string; quote: string; skippable?: boolean; onSkip?: () => void };
      void this.startTransition(p.phase, p.quote, p.skippable, p.onSkip);
    });

    this.bus.subscribe('transition_complete', () => {
      this.endTransition();
    });

    // Listen for phase changes — body class toggling is now handled by PhaseContent.onPhaseEnter
    this.bus.subscribe('phase_changed', () => {
      // Body class is set by PhaseContent.onPhaseEnter via transition_start → onPhaseEnter
    });

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
      // Apply stagger delay before triggering the reveal animation
      // so panels cascade in rather than appearing simultaneously.
      if (revealDelayMs > 0) {
        el.style.animationDelay = `${revealDelayMs}ms`;
      }
      // Phase-based reveal: mark as unlocked and trigger animation
      el.classList.add('panel-unlocked', 'panel-revealed');
      this.bus.emit('panel_revealed', { panelId });
    }
  }

  /**
   * Begin the phase transition visual sequence.
   * Shows the overlay with the phase name and lore quote, pulses the indicator, dims panels.
   *
   * @param phase           The new phase being entered.
   * @param quote           The lore quote to display.
   * @param skippable       Whether the transition can be skipped (prestige runs).
   * @param onSkip          Callback invoked when the player skips the transition.
   */
  startTransition(phase: string, quote: string, skippable: boolean = false, onSkip?: () => void): Promise<void> {
    if (!this.transitionOverlay) return Promise.resolve();

    // Clean up any previous transition state
    if (this.transitionCleanup) {
      this.transitionCleanup();
      this.transitionCleanup = null;
    }
    if (this.transitionResolve) {
      this.transitionResolve();
      this.transitionResolve = null;
    }

    // Create a promise that resolves when transition ends (skip or complete)
    const transitionPromise = new Promise<void>((resolve) => {
      this.transitionResolve = resolve;
    });

    // Format phase name: "egg_laying" → "Egg Laying"
    const phaseName = phase
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Build overlay content: phase name + lore quote + optional skip hint
    let overlayHTML =
      `<div class="phase-transition-phase-name">${phaseName}</div>` +
      `<div class="phase-transition-quote">${quote}</div>`;

    if (skippable) {
      overlayHTML += `<div class="phase-transition-skip-hint">Click to skip</div>`;
    }

    this.transitionOverlay.innerHTML = overlayHTML;
    this.transitionOverlay.style.display = '';
    this.transitionOverlay.classList.add('active');

    // ── Skip handler for prestige runs ──
    if (skippable && onSkip) {
      const handleSkip = () => {
        onSkip();
        this.endTransition();
      };

      // Click on overlay to skip
      this.transitionOverlay!.addEventListener('click', handleSkip);

      // Also allow keypress (Space/Enter/Escape)
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          handleSkip();
        }
      };
      document.addEventListener('keydown', handleKey);

      this.transitionCleanup = () => {
        this.transitionOverlay?.removeEventListener('click', handleSkip);
        document.removeEventListener('keydown', handleKey);
      };
    }

    // Pulse the phase indicator
    const indicator = document.querySelector('.phase-indicator');
    if (indicator) {
      indicator.classList.add('transitioning');
    }

    // Dim all visible panel elements
    const panels = document.querySelectorAll('.panel');
    panels.forEach((panel) => panel.classList.add('transition-dimmed'));

    return transitionPromise;
  }

  /**
   * End the phase transition — fade out overlay, undim panels, scroll to new content.
   */
  endTransition(): void {
    if (!this.transitionOverlay) return;

    // Clean up skip handler if set
    if (this.transitionCleanup) {
      this.transitionCleanup();
      this.transitionCleanup = null;
    }

    // Resolve transition promise if pending
    if (this.transitionResolve) {
      this.transitionResolve();
      this.transitionResolve = null;
    }

    this.transitionOverlay.classList.remove('active');

    // Undim panels
    const panels = document.querySelectorAll('.panel.transition-dimmed');
    panels.forEach((panel) => panel.classList.remove('transition-dimmed'));

    // Remove transitioning class from phase indicator
    const indicator = document.querySelector('.phase-indicator');
    if (indicator) {
      indicator.classList.remove('transitioning');
    }

    // Auto-scroll to first newly revealed panel
    const firstUnlocked = document.querySelector('.panel-unlocked');
    if (firstUnlocked) {
      firstUnlocked.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
