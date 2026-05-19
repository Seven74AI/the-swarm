import type { Store } from '../state/Store';
import type { EventBus } from '../engine/EventBus';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { BattleSystem } from '../systems/BattleSystem';
import type { SaveManager } from '../persistence/SaveManager';
import type { GameState } from '../state/GameState';
import { ClickButton } from './components/ClickButton';
import { ResourcePanel } from './panels/ResourcePanel';
import { EventLog } from './panels/EventLog';
import { PhaseIndicator } from './panels/PhaseIndicator';
import { WorkerAssignment } from './panels/WorkerAssignment';
import { SoldierPanel } from './panels/SoldierPanel';
import { BattlePanel } from './panels/BattlePanel';
import { BuildingPanel } from './panels/BuildingPanel';
import { ExpeditionPanel } from './panels/ExpeditionPanel';

/**
 * Root UI controller. Mounts all panels into #app.
 * Layout: #top-bar (summary), #activity-log, #panels (content).
 */
export class UIRoot {
  private bus: EventBus;
  private store: Store;
  private resourceSystem: ResourceSystem;
  private soldierSystem: SoldierSystem;
  private battleSystem: BattleSystem;
  private saveManager: SaveManager;
  private getState: () => GameState;
  private setState: (state: GameState) => void;
  private eventLog: EventLog;
  private panelElements: Map<string, HTMLElement> = new Map();

  constructor(deps: {
    bus: EventBus;
    store: Store;
    resourceSystem: ResourceSystem;
    soldierSystem: SoldierSystem;
    battleSystem: BattleSystem;
    saveManager: SaveManager;
    getState: () => GameState;
    setState: (state: GameState) => void;
  }) {
    this.bus = deps.bus;
    this.store = deps.store;
    this.resourceSystem = deps.resourceSystem;
    this.soldierSystem = deps.soldierSystem;
    this.battleSystem = deps.battleSystem;
    this.saveManager = deps.saveManager;
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
      this.store,
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
    const resourcePanel = new ResourcePanel(this.store);
    panels.appendChild(resourcePanel.getElement());
    this.panelElements.set('resource_panel', resourcePanel.getElement());

    // Worker assignment panel (hidden initially, revealed in colony phase)
    const workerAssignment = new WorkerAssignment(
      this.store,
      this.bus,
      this.resourceSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(workerAssignment.getElement());
    this.panelElements.set('worker_assignment', workerAssignment.getElement());

    // Soldier panel (hidden initially, revealed in combat phase)
    const soldierPanel = new SoldierPanel(
      this.store,
      this.bus,
      this.soldierSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(soldierPanel.getElement());
    this.panelElements.set('soldier_panel', soldierPanel.getElement());

    // Battle panel (hidden initially, revealed in combat phase)
    const battlePanel = new BattlePanel(
      this.store,
      this.bus,
      this.soldierSystem,
      this.battleSystem,
      this.getState,
      this.setState,
    );
    panels.appendChild(battlePanel.getElement());
    this.panelElements.set('battle_panel', battlePanel.getElement());

    // Building panel (hidden initially, revealed in expansion phase)
    const buildingPanel = new BuildingPanel(this.store, this.getState, this.setState);
    panels.appendChild(buildingPanel.getElement());
    this.panelElements.set('building_panel', buildingPanel.getElement());

    // Expedition panel (hidden initially, revealed in expansion phase)
    const expeditionPanel = new ExpeditionPanel(
      this.store,
      this.getState,
      this.setState,
    );
    panels.appendChild(expeditionPanel.getElement());
    this.panelElements.set('expedition_panel', expeditionPanel.getElement());

    container.appendChild(panels);

    // Listen for worker changes to trigger narrative events
    this.store.subscribe('resources.workers', (value) => {
      this.eventLog.notifyWorkerCount(value as number);
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
