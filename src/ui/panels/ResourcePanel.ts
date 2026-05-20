import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import { EGG_HATCH_TIME, LARVA_MATURE_TIME } from '../../systems/ResourceSystem';
import { NumberDisplay } from '../components/NumberDisplay';
import { formatRate } from '../../utils/format';

const TEND_MULTIPLIER = 0.25;

/**
 * Displays all resources with pipeline rate indicators (/s and /min).
 *
 * #22: Uses text node references (textContent on spans) with dirty-checking
 * to avoid redundant DOM updates when formatted values haven't changed.
 */
export class ResourcePanel {
  private container: HTMLDivElement;
  private eggRateEl: HTMLSpanElement;
  private larvaRateEl: HTMLSpanElement;
  private lastEggRateText: string = '';
  private lastLarvaRateText: string = '';

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'panel resource-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Colony Resources';
    this.container.appendChild(title);

    // ── Eggs ──
    this.container.appendChild(new NumberDisplay('resources.eggs', '🥚 Eggs').getElement());
    this.eggRateEl = this.makeRateEl();
    this.container.appendChild(this.eggRateEl);
    this.container.appendChild(document.createElement('br'));

    // ── Larvae ──
    this.container.appendChild(new NumberDisplay('resources.larvae', '🐛 Larvae').getElement());
    this.larvaRateEl = this.makeRateEl();
    this.container.appendChild(this.larvaRateEl);
    this.container.appendChild(document.createElement('br'));

    // ── Workers ──
    this.container.appendChild(new NumberDisplay('resources.workers', '🐜 Workers').getElement());
    this.container.appendChild(document.createElement('br'));

    // ── Food ──
    this.container.appendChild(new NumberDisplay('resources.food', '🍞 Food').getElement());

    // Reactive rate indicators with dirty-checking
    effect(() => {
      const s = gameState.value;
      const ep = s.eggPipeline;

      const eggRate = ep.count > 0
        ? (ep.count / EGG_HATCH_TIME) * (1 + s.workersAssigned.tend * TEND_MULTIPLIER)
        : 0;
      const eggText = `→ ${formatRate(eggRate)}/s · ${formatRate(eggRate * 60)}/min`;
      if (eggText !== this.lastEggRateText) {
        this.eggRateEl.textContent = eggText;
        this.lastEggRateText = eggText;
      }

      const lp = s.larvaPipeline;
      const larvaRate = lp.count > 0 ? lp.count / LARVA_MATURE_TIME : 0;
      const larvaText = `→ ${formatRate(larvaRate)}/s · ${formatRate(larvaRate * 60)}/min`;
      if (larvaText !== this.lastLarvaRateText) {
        this.larvaRateEl.textContent = larvaText;
        this.lastLarvaRateText = larvaText;
      }
    });
  }

  private makeRateEl(): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'rate-indicator';
    return el;
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
