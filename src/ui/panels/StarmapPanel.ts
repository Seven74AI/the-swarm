import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { PLANETS } from '../../data/planets';

export class StarmapPanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'starmap-panel';
    this.container.className = 'panel starmap-panel';

    this.render();

    effect(() => {
      void gameState.value.spaceships;
      void gameState.value.spaceProbes;
      void gameState.value.discoveredPlanets;
      void gameState.value.spaceship;
      this.render();
    });
  }

  refresh(): void { this.render(); }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<span class="panel-title">🌟 Star Map</span>';
    this.container.appendChild(header);

    const hasShip = state.spaceship.level > 0;

    // --- Planet Star Map ---
    const planetSection = document.createElement('div');
    planetSection.className = 'starmap-section';
    const planetTitle = document.createElement('div');
    planetTitle.className = 'expedition-list-title';
    planetTitle.textContent = 'Celestial Bodies';
    planetSection.appendChild(planetTitle);

    const grid = document.createElement('div');
    grid.className = 'expedition-grid';

    for (const planet of PLANETS) {
      const discovered = state.discoveredPlanets.includes(planet.name);
      const card = document.createElement('div');
      card.className = `expedition-card${discovered ? '' : ' undiscovered'}`;
      card.innerHTML = `<div class="expedition-card-icon">${planet.icon}</div>
        <div class="expedition-card-name">${planet.name}</div>
        <div class="expedition-card-type">${planet.type.charAt(0).toUpperCase() + planet.type.slice(1)}</div>
        <div class="expedition-card-loot">${discovered ? planet.yields : '???'}</div>`;

      if (!discovered) {
        const badge = document.createElement('span');
        badge.className = 'starmap-undiscovered';
        badge.textContent = 'Undiscovered';
        card.appendChild(badge);
      }

      grid.appendChild(card);
    }
    planetSection.appendChild(grid);
    this.container.appendChild(planetSection);

    // --- Active Spaceships on Missions ---
    const shipsOnMission = state.spaceships.filter(
      (s) => s.status === 'exploring' || s.status === 'returning',
    );

    if (shipsOnMission.length > 0) {
      const shipSection = document.createElement('div');
      shipSection.className = 'starmap-section';
      const shipTitle = document.createElement('div');
      shipTitle.className = 'expedition-list-title';
      shipTitle.textContent = 'Spaceships on Mission';
      shipSection.appendChild(shipTitle);

      for (const ship of shipsOnMission) {
        const row = document.createElement('div');
        row.className = 'expedition-row';
        const typeLabel = ship.type.replace('_', ' ');
        const statusIcon = ship.status === 'exploring' ? '⏳' : '🔄';
        const timeLabel = ship.status === 'exploring'
          ? `Arriving in ${ship.missionTicksRemaining}`
          : `Returning — ${ship.missionTicksRemaining} left`;

        row.innerHTML = `<div class="expedition-row-info">
          <strong>${ship.destinationName || 'Deep Space'}</strong>
          <span class="text-muted">${typeLabel} Lv.${ship.level}</span>
        </div>
        <div class="expedition-row-status">${statusIcon} ${timeLabel}</div>`;
        shipSection.appendChild(row);
      }
      this.container.appendChild(shipSection);
    } else if (hasShip) {
      const noMissions = document.createElement('div');
      noMissions.className = 'exploration-hint';
      noMissions.textContent = 'No active missions. Launch a spaceship from the Exploration panel.';
      this.container.appendChild(noMissions);
    }

    // --- Active Probes ---
    if (state.spaceProbes.length > 0) {
      const probeSection = document.createElement('div');
      probeSection.className = 'starmap-section';
      const probeTitle = document.createElement('div');
      probeTitle.className = 'expedition-list-title';
      probeTitle.textContent = 'Active Probes';
      probeSection.appendChild(probeTitle);

      for (const probe of state.spaceProbes) {
        const row = document.createElement('div');
        row.className = 'expedition-row';
        row.innerHTML = `<div class="expedition-row-info">
          <strong>${probe.destination}</strong>
          <span class="text-muted">${probe.scouts} scouts</span>
        </div>
        <div class="expedition-row-status">⏳ ${probe.ticksRemaining}s</div>`;
        probeSection.appendChild(row);
      }
      this.container.appendChild(probeSection);
    }

    // --- Infrastructure (no ship) ---
    if (!hasShip && shipsOnMission.length === 0 && state.spaceProbes.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'exploration-hint';
      hint.textContent = 'Build a spaceship to begin exploring the cosmos.';
      this.container.appendChild(hint);
    }
  }

  getElement(): HTMLDivElement { return this.container; }
}
