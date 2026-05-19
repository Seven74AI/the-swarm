import type { Store } from '../../state/Store';
import type { EventBus } from '../../engine/EventBus';
import type { ResourceSystem } from '../../systems/ResourceSystem';
import type { GameState } from '../../state/GameState';
import { formatNumber } from '../../utils/format';

/**
 * The core "Lay Egg" button.
 * On click: calls ResourceSystem.clickEgg, updates state, shows click count.
 */
export class ClickButton {
  private container: HTMLDivElement;
  private button: HTMLButtonElement;
  private counter: HTMLSpanElement;

  constructor(
    private store: Store,
    private bus: EventBus,
    private resourceSystem: ResourceSystem,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.className = 'click-button-container';

    this.button = document.createElement('button');
    this.button.className = 'click-button btn';
    this.button.textContent = '🥚 Lay Egg';
    this.button.addEventListener('click', () => this.onClick());

    this.counter = document.createElement('span');
    this.counter.className = 'click-counter';

    this.container.appendChild(this.button);
    this.container.appendChild(this.counter);

    this.updateCounter();
    store.subscribe('stats.totalClicks', () => this.updateCounter());
  }

  private onClick(): void {
    const state = this.getState();
    const newState = this.resourceSystem.clickEgg(state);
    this.setState(newState);
    this.bus.emit('click:egg', {});
  }

  private updateCounter(): void {
    const clicks = this.store.read('stats.totalClicks') as number;
    this.counter.textContent = `Clicks: ${formatNumber(clicks)}`;
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
