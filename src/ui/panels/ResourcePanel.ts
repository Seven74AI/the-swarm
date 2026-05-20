import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import { EGG_HATCH_TIME, LARVA_MATURE_TIME } from '../../systems/ResourceSystem';
import { NumberDisplay } from '../components/NumberDisplay';
import { ProgressBar } from '../components/ProgressBar';

/**
 * Displays all resources: Eggs, Larvae, Workers, Food.
 * Uses @preact/signals-core effect() for automatic updates.
 */
export class ResourcePanel {
  private container: HTMLDivElement;
  private eggProgress: ProgressBar;
  private larvaProgress: ProgressBar;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'panel resource-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Colony Resources';
    this.container.appendChild(title);

    const eggs = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const larvae = new NumberDisplay('resources.larvae', '🐛 Larvae');
    const workers = new NumberDisplay('resources.workers', '🐜 Workers');
    const food = new NumberDisplay('resources.food', '🍞 Food');

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

    // Reactive: progress bars from pipeline
    effect(() => {
      const p = gameState.value.eggPipeline;
      const progress = p.count > 0 ? p.progress / (p.count / EGG_HATCH_TIME + p.progress) : 0;
      this.eggProgress.update(Math.min(1, progress) * EGG_HATCH_TIME, EGG_HATCH_TIME);
    });

    effect(() => {
      const p = gameState.value.larvaPipeline;
      const progress = p.count > 0 ? p.progress / (p.count / LARVA_MATURE_TIME + p.progress) : 0;
      this.larvaProgress.update(Math.min(1, progress) * LARVA_MATURE_TIME, LARVA_MATURE_TIME);
    });
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
