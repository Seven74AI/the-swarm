import type { Store } from '../state/Store';
import type { EventBus } from '../engine/EventBus';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { GameState } from '../state/GameState';
import { ClickButton } from './components/ClickButton';
import { ResourcePanel } from './panels/ResourcePanel';
import { EventLog } from './panels/EventLog';

/**
 * Root UI controller. Mounts all panels into #app.
 * Layout: #top-bar (summary), #activity-log, #panels (content).
 */
export class UIRoot {
  private bus: EventBus;
  private store: Store;
  private resourceSystem: ResourceSystem;
  private getState: () => GameState;
  private setState: (state: GameState) => void;
  private eventLog: EventLog;

  constructor(deps: {
    bus: EventBus;
    store: Store;
    resourceSystem: ResourceSystem;
    getState: () => GameState;
    setState: (state: GameState) => void;
  }) {
    this.bus = deps.bus;
    this.store = deps.store;
    this.resourceSystem = deps.resourceSystem;
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

    // Click button (always visible)
    const clickBtn = new ClickButton(
      this.store,
      this.bus,
      this.resourceSystem,
      this.getState,
      this.setState,
    );
    container.appendChild(clickBtn.getElement());

    // Activity log
    const logEl = this.eventLog.getElement();
    logEl.id = 'activity-log';
    container.appendChild(logEl);

    // Panels section
    const panels = document.createElement('div');
    panels.id = 'panels';
    const resourcePanel = new ResourcePanel(this.store);
    panels.appendChild(resourcePanel.getElement());
    container.appendChild(panels);

    // Listen for worker changes to trigger narrative events
    this.store.subscribe('resources.workers', (value) => {
      this.eventLog.notifyWorkerCount(value as number);
    });
  }
}
