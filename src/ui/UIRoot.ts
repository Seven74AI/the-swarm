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

/**
 * Root UI controller. Mounts all panels into #app.
 * State flows through @preact/signals-core — no Store dependency.
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

    // Phase indicator (always visible)
    const phaseIndicator = new PhaseIndicator(this.bus);
    container.appendChild(phaseIndicator.getElement());
    this.panelElements.set('phase_indicator', phaseIndicator.getElement());

    // Click button (always visible)
    const clickBtn = new ClickButton(
      this.bus,
      this.resourceSystem,
      this.saveManager,
      this.getState,
      this.setState,
    );
    container.appendChild(clickBtn.getElement());
    this.panelElements.set('click_button', clickBtn.getElement());

    // Activity log
    const logEl = this.eventLog.getElement();
    logEl.id = 'activity-log';
    container.appendChild(logEl);
    this.panelElements.set('event_log', logEl);

    // Panels section
    const panels = document.createElement('div');
    panels.id = 'panels';
    const resourcePanel = new ResourcePanel();
    panels.appendChild(resourcePanel.getElement());
    this.panelElements.set('resource_panel', resourcePanel.getElement());

    // Worker assignment panel (hidden initially, revealed in colony phase)
    const workerAssignment = new WorkerAssignment(
      this.bus,
      this.resourceSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(workerAssignment.getElement());
    this.panelElements.set('worker_assignment', workerAssignment.getElement());

    // Soldier panel (hidden initially, revealed in combat phase)
    const soldierPanel = new SoldierPanel(
      this.bus,
      this.soldierSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(soldierPanel.getElement());
    this.panelElements.set('soldier_panel', soldierPanel.getElement());

    // Battle panel (hidden initially, revealed in combat phase)
    const battlePanel = new BattlePanel(
      this.bus,
      this.soldierSystem,
      this.battleSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(battlePanel.getElement());
    this.panelElements.set('battle_panel', battlePanel.getElement());

    // Building panel (hidden initially, revealed in expansion phase)
    const buildingPanel = new BuildingPanel(this.bus, this.getState, this.setState);
    panels.appendChild(buildingPanel.getElement());
    this.panelElements.set('building_panel', buildingPanel.getElement());

    // Expedition panel (hidden initially, revealed in expansion phase)
    const expeditionPanel = new ExpeditionPanel(
      this.bus,
      this.getState,
      this.setState,
    );
    panels.appendChild(expeditionPanel.getElement());
    this.panelElements.set('expedition_panel', expeditionPanel.getElement());

    // Space exploration panel (hidden initially, revealed in space phase)
    const explorationPanel = new ExplorationPanel(
      this.bus,
      this.getState,
      this.setState,
    );
    panels.appendChild(explorationPanel.getElement());
    this.panelElements.set('exploration_panel', explorationPanel.getElement());

    // Map panel (hidden initially, revealed in expansion phase)
    const mapPanel = new MapPanel(
      this.mapSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(mapPanel.getElement());
    this.panelElements.set('map_panel', mapPanel.getElement());

    // Spaceship panel (hidden initially, revealed in space phase)
    const spaceshipPanel = new SpaceshipPanel(
      this.bus,
      this.getState,
      this.setState,
    );
    panels.appendChild(spaceshipPanel.getElement());
    this.panelElements.set('spaceship_panel', spaceshipPanel.getElement());

    container.appendChild(panels);

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
    // (read from signal via effect in EventLog? No — this is event-driven)
    // We keep using bus events for narrative. The worker count check is done
    // via event since main.ts emits workers_changed on tick.
    this.bus.subscribe('workers_changed', (payload: unknown) => {
      const p = payload as { workers: number };
      if (p.workers !== undefined) {
        this.eventLog.notifyWorkerCount(p.workers);
      }
    });
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
    }
  }
}
