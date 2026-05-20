import type { EventBus } from '../engine/EventBus';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { BattleSystem } from '../systems/BattleSystem';
import type { SaveManager } from '../persistence/SaveManager';
import type { GameState } from '../state/GameState';
import type { MapSystem } from '../systems/MapSystem';
import type { TerritorySystem } from '../systems/TerritorySystem';
import { ClickButton } from './components/ClickButton';
import { ResourcePanel } from './panels/ResourcePanel';
import { EventLog } from './panels/EventLog';
import { PhaseIndicator } from './panels/PhaseIndicator';
import { WorkerAssignment } from './panels/WorkerAssignment';
import { SoldierPanel } from './panels/SoldierPanel';
import { BattlePanel } from './panels/BattlePanel';
import { BuildingPanel } from './panels/BuildingPanel';
import { ExpeditionPanel } from './panels/ExpeditionPanel';
import { ExplorationPanel } from './panels/ExplorationPanel';
import { MapPanel } from './panels/MapPanel';
import { SpaceshipPanel } from './panels/SpaceshipPanel';
import { StarmapPanel } from './panels/StarmapPanel';
import { ResourceConverterPanel } from './panels/ResourceConverterPanel';
import { TechTreePanel } from './panels/TechTreePanel';
import { AutomationPanel } from './panels/AutomationPanel';

/**
 * Root UI controller. Mounts all panels into #app.
 * State flows through @preact/signals-core — no Store dependency.
 * Phase 4+ panels use lazy creation via createPanel() for progressive unfolding.
 */
export class UIRoot {
  private bus: EventBus;
  private resourceSystem: ResourceSystem;
  private soldierSystem: SoldierSystem;
  private battleSystem: BattleSystem;
  private saveManager: SaveManager;
  private mapSystem: MapSystem;
  private territorySystem: TerritorySystem;
  private getState: () => GameState;
  private setState: (state: GameState) => void;
  private eventLog: EventLog;
  private panelElements: Map<string, HTMLElement> = new Map();
  private transitionOverlay: HTMLElement | null = null;

  /** Container div (#panels) where all panels are appended. */
  private panelsContainer: HTMLElement | null = null;

  /** Registry mapping panelId → factory function. Populated in constructor. */
  private panelRegistry: Map<string, () => HTMLElement> = new Map();

  constructor(deps: {
    bus: EventBus;
    resourceSystem: ResourceSystem;
    soldierSystem: SoldierSystem;
    battleSystem: BattleSystem;
    saveManager: SaveManager;
    mapSystem: MapSystem;
    territorySystem: TerritorySystem;
    getState: () => GameState;
    setState: (state: GameState) => void;
  }) {
    this.bus = deps.bus;
    this.resourceSystem = deps.resourceSystem;
    this.soldierSystem = deps.soldierSystem;
    this.battleSystem = deps.battleSystem;
    this.saveManager = deps.saveManager;
    this.mapSystem = deps.mapSystem;
    this.territorySystem = deps.territorySystem;
    this.getState = deps.getState;
    this.setState = deps.setState;
    this.eventLog = new EventLog(this.bus);

    // ── Populate panel registry with factory functions ──
    // Phase 1 panels (mounted at boot for backward compat)
    this.panelRegistry.set('resource_panel', () => new ResourcePanel().getElement());
    this.panelRegistry.set('phase_indicator', () => new PhaseIndicator(this.bus).getElement());
    this.panelRegistry.set('click_button', () => new ClickButton(
      this.bus, this.resourceSystem, this.saveManager, this.getState, this.setState,
    ).getElement());
    this.panelRegistry.set('event_log', () => {
      const el = this.eventLog.getElement();
      el.id = 'activity-log';
      return el;
    });

    // Phase 2 panels
    this.panelRegistry.set('worker_assignment', () => new WorkerAssignment(
      this.bus, this.resourceSystem, this.getState, this.setState,
    ).getElement());

    // Phase 3 panels
    this.panelRegistry.set('soldier_panel', () => new SoldierPanel(
      this.bus, this.soldierSystem, this.getState, this.setState,
    ).getElement());
    this.panelRegistry.set('battle_panel', () => new BattlePanel(
      this.bus, this.soldierSystem, this.battleSystem, this.getState, this.setState,
    ).getElement());
    this.panelRegistry.set('building_panel', () => new BuildingPanel(
      this.bus, this.getState, this.setState,
    ).getElement());
    this.panelRegistry.set('expedition_panel', () => new ExpeditionPanel(
      this.bus, this.getState, this.setState,
    ).getElement());
    this.panelRegistry.set('map_panel', () => new MapPanel(
      this.mapSystem, this.getState, this.setState,
    ).getElement());

    // Phase 4 panels (lazy — created on demand)
    this.panelRegistry.set('spaceship_panel', () => new SpaceshipPanel(
      this.bus, this.getState, this.setState,
    ).getElement());
    this.panelRegistry.set('exploration_panel', () => new ExplorationPanel(
      this.bus, this.getState, this.setState,
    ).getElement());
    this.panelRegistry.set('starmap_panel', () => new StarmapPanel().getElement());
    this.panelRegistry.set('resource_converter_panel', () => new ResourceConverterPanel().getElement());

    // Phase 5 panels (lazy — created on demand)
    this.panelRegistry.set('tech_tree_panel', () => new TechTreePanel().getElement());
    this.panelRegistry.set('automation_panel', () => new AutomationPanel().getElement());
  }

  mount(container: HTMLElement): void {
    container.innerHTML = '';

    // Top bar
    const topBar = document.createElement('div');
    topBar.id = 'top-bar';
    topBar.className = 'top-bar';
    topBar.innerHTML =
      '<span class="game-title">🐜 THE SWARM</span>' +
      '<span class="game-phase">Queen\'s Chamber</span>';
    container.appendChild(topBar);

    // Phase indicator (always visible) — boot panel (Phase 1)
    const phaseIndicator = new PhaseIndicator(this.bus);
    container.appendChild(phaseIndicator.getElement());
    this.panelElements.set('phase_indicator', phaseIndicator.getElement());

    // Click button (always visible) — boot panel (Phase 1)
    const clickBtn = new ClickButton(
      this.bus,
      this.resourceSystem,
      this.saveManager,
      this.getState,
      this.setState,
    );
    container.appendChild(clickBtn.getElement());
    this.panelElements.set('click_button', clickBtn.getElement());

    // Activity log — boot panel (Phase 1)
    const logEl = this.eventLog.getElement();
    logEl.id = 'activity-log';
    container.appendChild(logEl);
    this.panelElements.set('event_log', logEl);

    // Panels section
    const panels = document.createElement('div');
    panels.id = 'panels';
    this.panelsContainer = panels;

    // ── Phase 1–3 panels: mount at boot (backward compat) ──
    const resourcePanel = new ResourcePanel();
    panels.appendChild(resourcePanel.getElement());
    this.panelElements.set('resource_panel', resourcePanel.getElement());

    // Worker assignment panel (Phase 2), hidden until colony phase
    const workerAssignment = new WorkerAssignment(
      this.bus,
      this.resourceSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(workerAssignment.getElement());
    this.panelElements.set('worker_assignment', workerAssignment.getElement());

    // Soldier panel (Phase 3), hidden until combat phase
    const soldierPanel = new SoldierPanel(
      this.bus,
      this.soldierSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(soldierPanel.getElement());
    this.panelElements.set('soldier_panel', soldierPanel.getElement());

    // Battle panel (Phase 3), hidden until combat phase
    const battlePanel = new BattlePanel(
      this.bus,
      this.soldierSystem,
      this.battleSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(battlePanel.getElement());
    this.panelElements.set('battle_panel', battlePanel.getElement());

    // Building panel (Phase 3), hidden until expansion phase
    const buildingPanel = new BuildingPanel(this.bus, this.getState, this.setState);
    panels.appendChild(buildingPanel.getElement());
    this.panelElements.set('building_panel', buildingPanel.getElement());

    // Expedition panel (Phase 3), hidden until expansion phase
    const expeditionPanel = new ExpeditionPanel(
      this.bus,
      this.getState,
      this.setState,
    );
    panels.appendChild(expeditionPanel.getElement());
    this.panelElements.set('expedition_panel', expeditionPanel.getElement());

    // Map panel (Phase 3), hidden until expansion phase
    const mapPanel = new MapPanel(
      this.mapSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(mapPanel.getElement());
    this.panelElements.set('map_panel', mapPanel.getElement());

    // ── Phase 4+ panels are NOT mounted at boot ──
    // They are created lazily via createPanel() when their phase is entered.
    // This makes panel reveals feel like genuine new features.

    container.appendChild(panels);

    // ── Phase transition overlay ──
    this.transitionOverlay = document.createElement('div');
    this.transitionOverlay.id = 'phase-transition-overlay';
    this.transitionOverlay.style.display = 'none';
    document.body.appendChild(this.transitionOverlay);

    // ── Transition events ──
    this.bus.subscribe('transition_start', (payload: unknown) => {
      const p = payload as { phase: string; quote: string };
      this.startTransition(p.phase, p.quote);
    });

    this.bus.subscribe('transition_complete', () => {
      this.endTransition();
    });

    // Listen for phase changes to toggle space theme
    this.bus.subscribe('phase_changed', (payload: unknown) => {
      const phase = (payload as { phase: string }).phase;
      if (phase === 'space') {
        document.body.classList.add('phase-space');
      } else {
        document.body.classList.remove('phase-space');
      }
    });

    // Listen for worker changes to trigger narrative events
    this.bus.subscribe('workers_changed', (payload: unknown) => {
      const p = payload as { workers: number };
      if (p.workers !== undefined) {
        this.eventLog.notifyWorkerCount(p.workers);
      }
    });
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

    // Create and mount
    const element = factory();
    panelsEl.appendChild(element);
    this.panelElements.set(panelId, element);

    return element;
  }

  /**
   * Reveal a panel by its ID. If the panel element exists, shows it.
   * Used by PhaseContent.onPhaseEnter to unlock panels as phases advance.
   */
  showPanel(panelId: string): void {
    const el = this.panelElements.get(panelId);
    if (el) {
      el.style.display = '';
      el.classList.add('panel-unlocked');
      this.bus.emit('panel_revealed', { panelId });
    }
  }

  /**
   * Begin the phase transition visual sequence.
   * Shows the overlay with the phase name and lore quote, pulses the indicator, dims panels.
   */
  private startTransition(phase: string, quote: string): void {
    if (!this.transitionOverlay) return;

    // Format phase name: "egg_laying" → "Egg Laying"
    const phaseName = phase
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Set overlay content: phase name + lore quote
    this.transitionOverlay.innerHTML =
      `<div class="phase-transition-phase-name">${phaseName}</div>` +
      `<div class="phase-transition-quote">${quote}</div>`;
    this.transitionOverlay.style.display = '';
    this.transitionOverlay.classList.add('active');

    // Pulse the phase indicator
    const indicator = document.querySelector('.phase-indicator');
    if (indicator) {
      indicator.classList.add('transitioning');
    }

    // Dim all visible panel elements
    const panels = document.querySelectorAll('.panel');
    panels.forEach((panel) => panel.classList.add('transition-dimmed'));
  }

  /**
   * End the phase transition — fade out overlay, undim panels, scroll to new content.
   */
  private endTransition(): void {
    if (!this.transitionOverlay) return;

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
