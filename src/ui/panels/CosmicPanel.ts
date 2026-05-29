import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';

export class CosmicPanel {
  private container: HTMLDivElement;
  private renderScheduled = false;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'cosmic-panel';
    this.container.className = 'panel cosmic-panel';

    this.render();

    effect(() => {
      void gameState.value.discoveries;
      this.scheduleRender();
    });
  }

  /** Public refresh for tests. */
  refresh(): void {
    this.render();
  }

  private scheduleRender(): void {
    if (!this.renderScheduled) {
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        this.renderScheduled = false;
        this.render();
      });
    }
  }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();
    const discoveries = state.discoveries;

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🌌 Cosmic Discoveries';
    this.container.appendChild(title);

    if (discoveries.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'cosmic-hint';
      hint.textContent = 'No cosmic discoveries yet. Explore the cosmos to find wonders!';
      this.container.appendChild(hint);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'cosmic-discovery-list';

    // Show the most recent discoveries first (reverse chronological)
    const recent = discoveries.slice(-10).reverse();
    for (const discovery of recent) {
      const item = document.createElement('li');
      item.className = 'cosmic-discovery-item';
      item.textContent = discovery;
      list.appendChild(item);
    }

    this.container.appendChild(list);
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
