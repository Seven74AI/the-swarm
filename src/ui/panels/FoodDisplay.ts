import { effect } from '@preact/signals-core';
import { selectResources } from '../../state/selectors';
import { formatFull } from '../../utils/format';

/**
 * FoodDisplay panel (WRKR tab, Colony+): the food stock.
 *
 * Story 1.16 moved its rate part (production, consumption and net per tick)
 * to the resource strip's delta and the resource sheet's measured rate per
 * second, so the two can never disagree. The WRKR upkeep line comes with the
 * WRKR tab story.
 */
export class FoodDisplay {
  private container: HTMLDivElement;
  private foodCountEl: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'food-display';
    this.container.className = 'panel food-display-panel';
    this.container.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Food';
    this.container.appendChild(title);

    const stockRow = document.createElement('div');
    stockRow.className = 'stat-row';
    const stockLabel = document.createElement('span');
    stockLabel.className = 'stat-label';
    stockLabel.textContent = 'Stock:';
    this.foodCountEl = document.createElement('span');
    this.foodCountEl.className = 'stat-value';
    stockRow.appendChild(stockLabel);
    stockRow.appendChild(this.foodCountEl);
    this.container.appendChild(stockRow);

    effect(() => {
      this.foodCountEl.textContent = formatFull(selectResources.value.food);
    });
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
