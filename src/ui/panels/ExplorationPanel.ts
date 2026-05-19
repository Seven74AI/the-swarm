import type { Store } from '../../state/Store';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';

const DESTINATIONS = [
  'Proxima Centauri',
  'Alpha Centauri',
  'Sirius',
  'Betelgeuse',
  'Andromeda Gateway',
];

const MAX_PROBES = 3;

/**
 * ExplorationPanel — launch space probes to explore the cosmos.
 * Unlocked in SPACE phase after building a spaceship.
 */
export class ExplorationPanel {
  private container: HTMLDivElement;
  private renderScheduled = false;

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

    store.subscribe('spaceProbes', () => this.scheduleRender());
    store.subscribe('spaceship', () => this.scheduleRender());
    store.subscribe('soldiers', () => this.scheduleRender());
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

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🔭 Exploration';
    this.container.appendChild(title);

    // Launch form
    this.renderLaunchForm(state);

    // Active probes
    if (state.spaceProbes.length > 0) {
      const listTitle = document.createElement('div');
      listTitle.className = 'exploration-list-title';
      listTitle.textContent = 'Active Probes:';
      this.container.appendChild(listTitle);

      for (const probe of state.spaceProbes) {
        this.container.appendChild(this.createProbeRow(probe));
      }
    }

    // Discoveries
    if (state.discoveries.length > 0) {
      const discTitle = document.createElement('div');
      discTitle.className = 'exploration-list-title';
      discTitle.textContent = 'Discoveries:';
      this.container.appendChild(discTitle);

      for (const disc of state.discoveries.slice(-5)) {
        const row = document.createElement('div');
        row.className = 'stat-row';
        const span = document.createElement('span');
        span.className = 'stat-label';
        span.textContent = `✦ ${disc}`;
        row.appendChild(span);
        this.container.appendChild(row);
      }
    }
  }

  private renderLaunchForm(state: GameState): void {
    const form = document.createElement('div');
    form.className = 'exploration-launch';

    const label = document.createElement('span');
    label.textContent = `Scouts: ${state.soldiers.scouts}`;
    label.className = 'scout-count';
    form.appendChild(label);

    const scoutsInput = document.createElement('input');
    scoutsInput.type = 'number';
    scoutsInput.min = '1';
    scoutsInput.max = String(state.soldiers.scouts);
    scoutsInput.value = '1';
    scoutsInput.className = 'exploration-input';
    scoutsInput.setAttribute('placeholder', 'Scouts');
    form.appendChild(scoutsInput);

    const destSelect = document.createElement('select');
    destSelect.className = 'exploration-select';
    for (const dest of DESTINATIONS) {
      const opt = document.createElement('option');
      opt.value = dest;
      opt.textContent = dest;
      destSelect.appendChild(opt);
    }
    form.appendChild(destSelect);

    const canLaunch =
      state.spaceship.level > 0 &&
      state.soldiers.scouts > 0 &&
      state.spaceProbes.length < MAX_PROBES;

    const btn = document.createElement('button');
    btn.textContent = '🚀 Launch Probe';
    btn.className = 'btn';
    btn.disabled = !canLaunch;

    btn.addEventListener('click', () => {
      const scouts = parseInt(scoutsInput.value, 10) || 1;
      const dest = destSelect.value;
      const s = this.getState();
      if (
        s.spaceship.level > 0 &&
        s.soldiers.scouts >= scouts &&
        s.spaceProbes.length < MAX_PROBES
      ) {
        const probe = {
          id: `probe_${Date.now()}`,
          destination: dest,
          ticksRemaining: 50 + Math.floor(Math.random() * 50),
          scouts,
        };
        this.bus.emit('probe_launch', probe);
        this.setState({
          ...s,
          soldiers: {
            ...s.soldiers,
            scouts: s.soldiers.scouts - scouts,
          },
          spaceProbes: [...s.spaceProbes, probe],
        });
      }
    });

    form.appendChild(btn);
    this.container.appendChild(form);
  }

  private createProbeRow(probe: {
    id: string;
    destination: string;
    ticksRemaining: number;
    scouts: number;
  }): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'stat-row exploration-row';

    const info = document.createElement('span');
    info.className = 'stat-label';
    info.textContent = `${probe.destination} (${probe.scouts}S)`;
    row.appendChild(info);

    const timer = document.createElement('span');
    timer.className = 'stat-value';
    timer.textContent = `${probe.ticksRemaining}⏳`;
    row.appendChild(timer);

    return row;
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
