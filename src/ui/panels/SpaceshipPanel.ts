import { effect, untracked } from '@preact/signals-core';
import {
  selectSpaceship,
  selectResources,
} from '../../state/selectors';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';

import type { Actions } from '../../actions';
import { explain } from './refusal';
import { MAX_SHIP_LEVEL, canAffordShipCost, getShipCost } from '../../state/queries';

export class SpaceshipPanel {
  private container: HTMLDivElement;
  private renderScheduled = false;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private actions: Actions,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'spaceship-panel';
    this.container.className = 'panel spaceship-panel';

    this.render();

    effect(() => {
      void selectSpaceship.value;
      void selectResources.value;
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
    const ship = state.spaceship;

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Spaceship';
    this.container.appendChild(title);

    if (ship.level === 0) {
      this.renderBuildSection(state);
    } else {
      this.renderShipStats(state);
    }
  }

  private renderBuildSection(state: GameState): void {
    const cost = getShipCost(0);
    const canBuild = canAffordShipCost(state, cost);

    const info = document.createElement('div');
    info.className = 'spaceship-info';
    info.textContent = 'No spaceship yet. Build one to explore the cosmos.';
    this.container.appendChild(info);

    const costEl = document.createElement('div');
    costEl.className = 'spaceship-cost';
    costEl.textContent =
      `Cost: ${cost.food} food, ${cost.wood} wood, ${cost.stone} stone, ${cost.nectar} nectar` +
      (cost.voidCrystals > 0 ? `, ${cost.voidCrystals} void crystals, ${cost.antimatter} antimatter, ${cost.darkMatter} dark matter` : '');
    this.container.appendChild(costEl);

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Build Spaceship';
    btn.disabled = !canBuild;

    btn.addEventListener('click', () => {
      // The action raises spaceship_build after its write.
      explain(btn, this.actions.buildShip());
    });

    this.container.appendChild(btn);
  }

  private renderShipStats(state: GameState): void {
    const ship = state.spaceship;
    const cost = getShipCost(ship.level);
    const canUpgrade = ship.level < MAX_SHIP_LEVEL && canAffordShipCost(state, cost);

    const levelEl = document.createElement('div');
    levelEl.className = 'spaceship-level';
    levelEl.textContent = `Lv.${ship.level}`;
    this.container.appendChild(levelEl);

    const fuelEl = document.createElement('div');
    fuelEl.className = 'spaceship-fuel';
    fuelEl.textContent = `Fuel: ${ship.fuel} / ${ship.maxFuel}`;
    this.container.appendChild(fuelEl);

    if (ship.level < MAX_SHIP_LEVEL) {
      const costEl = document.createElement('div');
      costEl.className = 'spaceship-cost';
      costEl.textContent =
        `Upgrade cost: ${cost.voidCrystals} void crystals, ${cost.antimatter} antimatter, ${cost.darkMatter} dark matter`;
      this.container.appendChild(costEl);

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Upgrade';
      btn.disabled = !canUpgrade;

      btn.addEventListener('click', () => {
        // The action raises spaceship_upgrade after its write.
        explain(btn, this.actions.upgradeShip());
      });

      this.container.appendChild(btn);
    } else {
      const maxed = document.createElement('div');
      maxed.className = 'spaceship-maxed';
      maxed.textContent = 'Spaceship fully upgraded.';
      this.container.appendChild(maxed);
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
