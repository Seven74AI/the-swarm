import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { ResourceSystem } from '../../systems/ResourceSystem';
import type { SaveManager } from '../../persistence/SaveManager';
import type { GameState } from '../../state/GameState';
import { formatNumber } from '../../utils/format';

/**
 * The core "Lay Egg" button.
 * On click: calls ResourceSystem.clickEgg, updates state, triggers save.
 */
export class ClickButton {
  private container: HTMLDivElement;
  private button: HTMLButtonElement;
  private counter: HTMLSpanElement;
  private dispose: () => void;

  constructor(
    private bus: EventBus,
    private resourceSystem: ResourceSystem,
    private saveManager: SaveManager,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.className = 'click-button-container';

    this.button = document.createElement('button');
    this.button.id = 'click-egg';
    this.button.className = 'click-button btn';
    this.button.textContent = '🥚 Lay Egg';
    this.button.addEventListener('click', () => this.onClick());

    this.counter = document.createElement('span');
    this.counter.className = 'click-counter';

    this.container.appendChild(this.button);
    this.container.appendChild(this.counter);

    this.updateCounter(gameState.value.stats.totalClicks);

    // Reactive: only re-runs when totalClicks changes
    this.dispose = effect(() => {
      this.updateCounter(gameState.value.stats.totalClicks);
    });
  }

  private onClick(): void {
    const state = this.getState();
    const newState = this.resourceSystem.clickEgg(state);
    this.setState(newState);
    this.bus.emit('click:egg', {});
    this.saveManager.save(newState, newState.stats.playTimeMs);
  }

  private updateCounter(clicks: number): void {
    this.counter.textContent = `Clicks: ${formatNumber(clicks)}`;
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
