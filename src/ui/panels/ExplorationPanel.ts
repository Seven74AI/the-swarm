import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { formatNumber } from '../../utils/format';
import { PLANETS } from '../../data/planets';

const MAX_PROBES = 3;

export class ExplorationPanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'exploration-panel';
    this.container.className = 'panel exploration-panel';

    this.render();

    effect(() => {
      void gameState.value.spaceProbes;
      void gameState.value.spaceship;
      void gameState.value.soldiers;
      this.render();
    });
  }

  refresh(): void { this.render(); }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();
    const hasShip = state.spaceship.level > 0;
    const canLaunch = hasShip && state.soldiers.scouts > 0 && state.spaceProbes.length < MAX_PROBES;

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<span class="panel-title">🔭 Space Exploration</span>
      <span class="panel-sub">Scouts: ${formatNumber(state.soldiers.scouts)} · Probes: ${state.spaceProbes.length}/${MAX_PROBES}</span>`;
    this.container.appendChild(header);

    if (!hasShip) {
      const hint = document.createElement('div');
      hint.className = 'exploration-hint';
      hint.textContent = 'Build a spaceship first to explore the cosmos.';
      this.container.appendChild(hint);
      return;
    }

    // Planet cards
    const grid = document.createElement('div');
    grid.className = 'expedition-grid';

    for (const planet of PLANETS) {
      const card = document.createElement('div');
      card.className = 'expedition-card';
      card.innerHTML = `<div class="expedition-card-icon">${planet.icon}</div>
        <div class="expedition-card-name">${planet.name}</div>
        <div class="expedition-card-type">${planet.type.charAt(0).toUpperCase() + planet.type.slice(1)}</div>
        <div class="expedition-card-loot">${planet.yields}</div>`;

      const btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.textContent = '🚀 Launch';
      btn.disabled = !canLaunch;
      btn.addEventListener('click', () => {
        const s = this.getState();
        if (s.spaceship.level > 0 && s.soldiers.scouts > 0 && s.spaceProbes.length < MAX_PROBES) {
          const scouts = 1;
          const probe = {
            id: `probe_${Date.now()}`,
            destination: planet.name,
            ticksRemaining: 50 + Math.floor(Math.random() * 50),
            scouts,
          };
          this.bus.emit('probe_launch', probe);
          this.setState({
            ...s,
            soldiers: { ...s.soldiers, scouts: s.soldiers.scouts - scouts },
            spaceProbes: [...s.spaceProbes, probe],
          });
        }
      });
      card.appendChild(btn);
      grid.appendChild(card);
    }
    this.container.appendChild(grid);

    // Active probes
    if (state.spaceProbes.length > 0) {
      const activeTitle = document.createElement('div');
      activeTitle.className = 'expedition-list-title';
      activeTitle.textContent = 'Active Probes:';
      this.container.appendChild(activeTitle);

      for (const probe of state.spaceProbes) {
        const row = document.createElement('div');
        row.className = 'expedition-row';
        const rowInfo = document.createElement('div');
        rowInfo.className = 'expedition-row-info';
        const destStrong = document.createElement('strong');
        destStrong.textContent = probe.destination;
        rowInfo.appendChild(destStrong);
        rowInfo.appendChild(document.createTextNode(' '));
        const mutedSpan = document.createElement('span');
        mutedSpan.className = 'text-muted';
        mutedSpan.textContent = `${probe.scouts}S`;
        rowInfo.appendChild(mutedSpan);
        row.appendChild(rowInfo);
        const rowStatus = document.createElement('div');
        rowStatus.className = 'expedition-row-status';
        rowStatus.textContent = `⏳ ${probe.ticksRemaining}s`;
        row.appendChild(rowStatus);
        this.container.appendChild(row);
      }
    }
  }

  getElement(): HTMLDivElement { return this.container; }
}
