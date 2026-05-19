import type { Store } from '../../state/Store';
import { NumberDisplay } from '../components/NumberDisplay';

/**
 * Displays all resources: Eggs, Larvae, Workers, Food.
 * Subscribes to Store for automatic updates.
 */
export class ResourcePanel {
  private container: HTMLDivElement;

  constructor(private store: Store) {
    this.container = document.createElement('div');
    this.container.className = 'panel resource-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Colony Resources';
    this.container.appendChild(title);

    const eggs = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const larvae = new NumberDisplay(store, 'resources.larvae', '🐛 Larvae');
    const workers = new NumberDisplay(store, 'resources.workers', '🐜 Workers');
    const food = new NumberDisplay(store, 'resources.food', '🍞 Food');

    this.container.appendChild(eggs.getElement());
    this.container.appendChild(document.createElement('br'));
    this.container.appendChild(larvae.getElement());
    this.container.appendChild(document.createElement('br'));
    this.container.appendChild(workers.getElement());
    this.container.appendChild(document.createElement('br'));
    this.container.appendChild(food.getElement());
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
