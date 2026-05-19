import type { Store } from '../../state/Store';
import { NumberDisplay } from '../components/NumberDisplay';
import { ProgressBar } from '../components/ProgressBar';
import { EGG_HATCH_TIME, LARVA_MATURE_TIME } from '../../systems/ResourceSystem';

/**
 * Displays all resources: Eggs, Larvae, Workers, Food.
 * Also shows egg/larva maturation progress bars.
 * Subscribes to Store for automatic updates.
 */
export class ResourcePanel {
  private container: HTMLDivElement;
  private eggProgress: ProgressBar;
  private larvaProgress: ProgressBar;

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

    // Egg maturation progress bar
    this.eggProgress = new ProgressBar('Egg hatching');
    this.container.appendChild(document.createElement('br'));
    this.container.appendChild(this.eggProgress.getElement());

    // Larva maturation progress bar
    this.larvaProgress = new ProgressBar('Larva maturing');
    this.container.appendChild(this.larvaProgress.getElement());

    // Subscribe to timers for progress updates
    store.subscribe('eggHatchTimers', (timers) => {
      const arr = timers as number[];
      const min = arr.length > 0 ? Math.min(...arr) : EGG_HATCH_TIME;
      this.eggProgress.update(EGG_HATCH_TIME - min, EGG_HATCH_TIME);
    });

    store.subscribe('larvaMatureTimers', (timers) => {
      const arr = timers as number[];
      const min = arr.length > 0 ? Math.min(...arr) : LARVA_MATURE_TIME;
      this.larvaProgress.update(LARVA_MATURE_TIME - min, LARVA_MATURE_TIME);
    });
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
