import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { GameState } from '../../state/GameState';
import { formatNumber } from '../../utils/format';

const FOOD_PER_GATHER = 2;
const FOOD_PER_UNASSIGNED = 1;
const FOOD_CONSUMED_PER_2_WORKERS = 1;

/**
 * FoodDisplay panel — shows food production and consumption in colony phases.
 * Displays current food stock, production rate, consumption rate, and net per tick.
 * Revealed in Phase COLONY+ via PhaseContent.
 */
export class FoodDisplay {
  private container: HTMLDivElement;
  private foodCountEl: HTMLSpanElement;
  private productionEl: HTMLSpanElement;
  private consumptionEl: HTMLSpanElement;
  private netEl: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'food-display';
    this.container.className = 'panel food-display-panel';
    this.container.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🍞 Food';
    this.container.appendChild(title);

    // Current food stock row
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

    // Production row
    const prodRow = document.createElement('div');
    prodRow.className = 'stat-row';
    const prodLabel = document.createElement('span');
    prodLabel.className = 'stat-label';
    prodLabel.textContent = 'Production:';
    this.productionEl = document.createElement('span');
    this.productionEl.className = 'stat-value food-positive';
    prodRow.appendChild(prodLabel);
    prodRow.appendChild(this.productionEl);
    this.container.appendChild(prodRow);

    // Consumption row
    const consRow = document.createElement('div');
    consRow.className = 'stat-row';
    const consLabel = document.createElement('span');
    consLabel.className = 'stat-label';
    consLabel.textContent = 'Consumption:';
    this.consumptionEl = document.createElement('span');
    this.consumptionEl.className = 'stat-value food-negative';
    consRow.appendChild(consLabel);
    consRow.appendChild(this.consumptionEl);
    this.container.appendChild(consRow);

    // Net row
    const netRow = document.createElement('div');
    netRow.className = 'stat-row';
    const netLabel = document.createElement('span');
    netLabel.className = 'stat-label';
    netLabel.textContent = 'Net:';
    this.netEl = document.createElement('span');
    this.netEl.className = 'stat-value';
    netRow.appendChild(netLabel);
    netRow.appendChild(this.netEl);
    this.container.appendChild(netRow);

    // Reactive: refresh display when state changes
    effect(() => {
      const s = gameState.value;
      this.refresh(s);
    });
  }

  private refresh(state: GameState): void {
    const w = state.resources.workers;
    const a = state.workersAssigned;
    const assigned = a.gather + a.tend + a.dig + a.guard;
    const unassigned = Math.max(0, w - assigned);
    const produced = a.gather * FOOD_PER_GATHER + unassigned * FOOD_PER_UNASSIGNED;
    const consumed = Math.floor(w / 2) * FOOD_CONSUMED_PER_2_WORKERS;
    const net = produced - consumed;

    this.foodCountEl.textContent = formatNumber(state.resources.food);
    this.productionEl.textContent = produced > 0 ? `+${produced}/tick` : `${produced}/tick`;
    this.consumptionEl.textContent = consumed > 0 ? `-${consumed}/tick` : `0/tick`;
    this.netEl.textContent = net >= 0 ? `+${net}/tick` : `${net}/tick`;
    this.netEl.className = net >= 0 ? 'stat-value food-positive' : 'stat-value food-negative';
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
