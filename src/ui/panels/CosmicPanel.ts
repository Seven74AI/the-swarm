import { effect, untracked } from '@preact/signals-core';
import {
  selectDiscoveries,
} from '../../state/selectors';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';

export class CosmicPanel {
  private container: HTMLDivElement;
  private renderScheduled = false;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'cosmic-panel';
    this.container.className = 'panel cosmic-panel';

    this.render();

    effect(() => {
      void selectDiscoveries.value;
      // Render reads through getState(); keep it from subscribing to the whole state.
      untracked(() => this.scheduleRender());
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
      hint.textContent = 'No cosmic discoveries yet. Explorations find them.';
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
