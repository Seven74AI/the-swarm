import { effect, untracked } from '@preact/signals-core';
import {
  selectSpaceProbes,
  selectSpaceship,
  selectSoldiers,
  selectResources,
} from '../../state/selectors';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { formatFull } from '../../utils/format';
import { PLANETS } from '../../data/planets';
import { MAX_PROBES, PROBE_SWARM_THRESHOLD } from '../../state/queries';
import type { Actions } from '../../actions';
import { explain } from '../components/refusal';

export class ExplorationPanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private actions: Actions,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'exploration-panel';
    this.container.className = 'panel exploration-panel';

    this.render();

    effect(() => {
      void selectSpaceProbes.value;
      void selectSpaceship.value;
      void selectSoldiers.value;
      void selectResources.value;
      // Render reads through getState(); keep it from subscribing to the whole state.
      untracked(() => this.render());
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
    const surveyInfo = state.resources.surveyData >= PROBE_SWARM_THRESHOLD
      ? ` · 📡 Survey: ${formatFull(state.resources.surveyData)} (Swarm Active)`
      : ` · 📡 Survey: ${formatFull(state.resources.surveyData)}`;
    header.innerHTML = `<span class="panel-title">🔭 Space Exploration</span>
      <span class="panel-sub">Scouts: ${formatFull(state.soldiers.scouts)} · Probes: ${state.spaceProbes.length}/${MAX_PROBES}${surveyInfo}</span>`;
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
        // The action raises probe_launch after its write.
        explain(btn, this.actions.launchProbe(planet.name));
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
        rowStatus.textContent = `⏳ ${Math.max(0, Math.ceil(probe.remainingMs / 1000))}s`;
        row.appendChild(rowStatus);
        this.container.appendChild(row);
      }
    }
  }

  getElement(): HTMLDivElement { return this.container; }
}
