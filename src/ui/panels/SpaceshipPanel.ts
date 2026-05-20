import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';

/** Spaceship build costs per level. */
const SHIP_COSTS: Array<{ voidCrystals: number; antimatter: number; darkMatter: number }> = [
  { voidCrystals: 50, antimatter: 25, darkMatter: 5 },
  { voidCrystals: 100, antimatter: 50, darkMatter: 10 },
  { voidCrystals: 200, antimatter: 100, darkMatter: 20 },
];

const MAX_SHIP_LEVEL = 5;

export class SpaceshipPanel {
  private container: HTMLDivElement;
  private renderScheduled = false;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'spaceship-panel';
    this.container.className = 'panel spaceship-panel';

    this.render();

    effect(() => {
      void gameState.value.spaceship;
      void gameState.value.resources;
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
    const ship = state.spaceship;

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🚀 Spaceship';
    this.container.appendChild(title);

    if (ship.level === 0) {
      this.renderBuildSection(state);
    } else {
      this.renderShipStats(state);
    }
  }

  private renderBuildSection(state: GameState): void {
    const cost = SHIP_COSTS[0];
    const r = state.resources;
    const canBuild =
      r.voidCrystals >= cost.voidCrystals &&
      r.antimatter >= cost.antimatter &&
      r.darkMatter >= cost.darkMatter;

    const info = document.createElement('div');
    info.className = 'spaceship-info';
    info.textContent = 'No spaceship built yet. Build one to explore the cosmos!';
    this.container.appendChild(info);

    const costEl = document.createElement('div');
    costEl.className = 'spaceship-cost';
    costEl.textContent =
      `Cost: ${cost.voidCrystals} voidC, ${cost.antimatter} antimatter, ${cost.darkMatter} darkM`;
    this.container.appendChild(costEl);

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🔧 Build Spaceship';
    btn.disabled = !canBuild;

    btn.addEventListener('click', () => {
      const s = this.getState();
      if (
        s.resources.voidCrystals >= cost.voidCrystals &&
        s.resources.antimatter >= cost.antimatter &&
        s.resources.darkMatter >= cost.darkMatter
      ) {
        this.bus.emit('spaceship_build', { level: 1 });
        this.setState({
          ...s,
          resources: {
            ...s.resources,
            voidCrystals: s.resources.voidCrystals - cost.voidCrystals,
            antimatter: s.resources.antimatter - cost.antimatter,
            darkMatter: s.resources.darkMatter - cost.darkMatter,
          },
          spaceship: {
            level: 1,
            fuel: 100,
            maxFuel: 100,
          },
        });
      }
    });

    this.container.appendChild(btn);
  }

  private renderShipStats(state: GameState): void {
    const ship = state.spaceship;
    const costIdx = Math.min(ship.level, SHIP_COSTS.length - 1);
    const cost = SHIP_COSTS[costIdx];
    const r = state.resources;
    const canUpgrade =
      ship.level < MAX_SHIP_LEVEL &&
      r.voidCrystals >= cost.voidCrystals &&
      r.antimatter >= cost.antimatter &&
      r.darkMatter >= cost.darkMatter;

    const levelEl = document.createElement('div');
    levelEl.className = 'spaceship-level';
    levelEl.textContent = `Lv.${ship.level}`;
    this.container.appendChild(levelEl);

    const fuelEl = document.createElement('div');
    fuelEl.className = 'spaceship-fuel';
    fuelEl.textContent = `⛽ Fuel: ${ship.fuel} / ${ship.maxFuel}`;
    this.container.appendChild(fuelEl);

    if (ship.level < MAX_SHIP_LEVEL) {
      const costEl = document.createElement('div');
      costEl.className = 'spaceship-cost';
      costEl.textContent =
        `Upgrade cost: ${cost.voidCrystals} voidC, ${cost.antimatter} antimatter, ${cost.darkMatter} darkM`;
      this.container.appendChild(costEl);

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = '🔧 Upgrade';
      btn.disabled = !canUpgrade;

      btn.addEventListener('click', () => {
        const s = this.getState();
        if (
          s.spaceship.level < MAX_SHIP_LEVEL &&
          s.resources.voidCrystals >= cost.voidCrystals &&
          s.resources.antimatter >= cost.antimatter &&
          s.resources.darkMatter >= cost.darkMatter
        ) {
          const newLevel = s.spaceship.level + 1;
          const newMaxFuel = 100 + (newLevel - 1) * 100;
          this.bus.emit('spaceship_upgrade', { level: newLevel });
          this.setState({
            ...s,
            resources: {
              ...s.resources,
              voidCrystals: s.resources.voidCrystals - cost.voidCrystals,
              antimatter: s.resources.antimatter - cost.antimatter,
              darkMatter: s.resources.darkMatter - cost.darkMatter,
            },
            spaceship: {
              level: newLevel,
              fuel: s.spaceship.fuel,
              maxFuel: newMaxFuel,
            },
          });
        }
      });

      this.container.appendChild(btn);
    } else {
      const maxed = document.createElement('div');
      maxed.className = 'spaceship-maxed';
      maxed.textContent = 'Spaceship fully upgraded!';
      this.container.appendChild(maxed);
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
