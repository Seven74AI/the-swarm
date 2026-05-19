import type { Store } from '../../state/Store';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { launchExploration } from '../../systems/ExplorationSystem';
import { MAX_ACTIVE_EXPLORATIONS, PLANETS } from '../../systems/ExplorationSystem';

/**
 * ExplorationPanel — launch interstellar explorations to planets.
 * Unlocked in SPACE phase.
 */
export class ExplorationPanel {
  private container: HTMLDivElement;

  constructor(
    private store: Store,
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'exploration-panel';
    this.container.className = 'panel exploration-panel';

    this.render();

    store.subscribe('spaceExplorations', () => this.render());
  }

  /** Public refresh for tests */
  refresh(): void {
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🚀 Interstellar Exploration';
    this.container.appendChild(title);

    // Space resources display
    const spaceResources = document.createElement('div');
    spaceResources.className = 'space-resources';
    spaceResources.innerHTML =
      `<span>💎 Void Crystals: ${state.resources.voidCrystals}</span>` +
      `<span>⚛️ Antimatter: ${state.resources.antimatter}</span>` +
      `<span>🌌 Dark Matter: ${state.resources.darkMatter}</span>`;
    this.container.appendChild(spaceResources);

    // Launch form
    this.container.appendChild(this.createLaunchForm(state));

    // Active explorations list
    if (state.spaceExplorations.length > 0) {
      const listTitle = document.createElement('div');
      listTitle.className = 'expedition-list-title';
      listTitle.textContent = 'Active Explorations:';
      this.container.appendChild(listTitle);

      for (const exp of state.spaceExplorations) {
        this.container.appendChild(this.createExplorationRow(exp));
      }
    }

    // Discovered planets list
    if (state.discoveredPlanets.length > 0) {
      const discTitle = document.createElement('div');
      discTitle.className = 'expedition-list-title';
      discTitle.textContent = 'Discovered Planets:';
      this.container.appendChild(discTitle);

      const list = document.createElement('div');
      list.className = 'discovered-list';
      for (const planet of state.discoveredPlanets) {
        const planetType = PLANETS.find((p) => p.name === planet)?.type ?? 'unknown';
        const planetEl = document.createElement('span');
        planetEl.className = 'stat-row';
        planetEl.textContent = `🪐 ${planet} (${planetType})`;
        list.appendChild(planetEl);
      }
      this.container.appendChild(list);
    }
  }

  private createLaunchForm(state: GameState): HTMLDivElement {
    const form = document.createElement('div');
    form.className = 'expedition-launch';

    const destSelect = document.createElement('select');
    destSelect.className = 'expedition-select';
    for (const planet of PLANETS) {
      const opt = document.createElement('option');
      opt.value = planet.name;
      const discovered = state.discoveredPlanets.includes(planet.name) ? ' ✓' : '';
      opt.textContent = `${planet.name} (${planet.type})${discovered}`;
      destSelect.appendChild(opt);
    }

    const btn = document.createElement('button');
    btn.textContent = '🚀 Launch';
    btn.className = 'btn';
    btn.disabled = state.spaceExplorations.length >= MAX_ACTIVE_EXPLORATIONS;

    btn.addEventListener('click', () => {
      const dest = destSelect.value;
      const s = this.getState();
      const updated = launchExploration(s, dest);
      if (updated !== s) {
        this.bus.emit('exploration_launch', { destination: dest });
      }
      this.setState(updated);
    });

    form.appendChild(destSelect);
    form.appendChild(btn);

    return form;
  }

  private createExplorationRow(exp: {
    id: string;
    destination: string;
    ticksRemaining: number;
    risk: number;
  }): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'stat-row expedition-row';

    const info = document.createElement('span');
    info.className = 'stat-label';
    info.textContent = `${exp.destination}`;
    row.appendChild(info);

    const timer = document.createElement('span');
    timer.className = 'stat-value';
    timer.textContent = `${exp.ticksRemaining}⏳ Risk: ${Math.round(exp.risk * 100)}%`;
    row.appendChild(timer);

    return row;
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
