import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { launchExpedition, MAX_ACTIVE_EXPEDITIONS } from '../../systems/ExpeditionSystem';
import { formatNumber } from '../../utils/format';

interface Destination {
  name: string;
  icon: string;
  loot: string;
}

const DESTINATIONS: Destination[] = [
  { name: 'MEADOW', icon: '🌼', loot: 'Nectar + Food' },
  { name: 'FOREST', icon: '🌲', loot: 'Wood + Food' },
  { name: 'MOUNTAIN', icon: '⛰️', loot: 'Stone + Food' },
];

export class ExpeditionPanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'expedition-panel';
    this.container.className = 'panel expedition-panel';

    this.render();

    effect(() => {
      void gameState.value.expeditions;
      void gameState.value.soldiers;
      this.render();
    });
  }

  refresh(): void { this.render(); }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();
    const canLaunch = state.expeditions.length < MAX_ACTIVE_EXPEDITIONS
      && (state.soldiers.scouts > 0 || state.soldiers.warriors > 0);

    // Title + available counts
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<span class="panel-title">🗺️ Expeditions</span>
      <span class="panel-sub">Scouts: ${formatNumber(state.soldiers.scouts)} · Warriors: ${formatNumber(state.soldiers.warriors)}</span>`;
    this.container.appendChild(header);

    // Destination cards
    const grid = document.createElement('div');
    grid.className = 'expedition-grid';

    for (const dest of DESTINATIONS) {
      const card = document.createElement('div');
      card.className = 'expedition-card';
      card.innerHTML = `<div class="expedition-card-icon">${dest.icon}</div>
        <div class="expedition-card-name">${dest.name}</div>
        <div class="expedition-card-loot">${dest.loot}</div>`;

      const btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.textContent = 'Send';
      btn.disabled = !canLaunch;
      if (btn.disabled) {
        btn.setAttribute('data-tooltip', this.sendTooltip(state));
      }
      btn.addEventListener('click', () => {
        const s = this.getState();
        const scouts = Math.min(1, s.soldiers.scouts);
        const warriors = Math.min(1, s.soldiers.warriors);
        const updated = launchExpedition(s, scouts, warriors, dest.name);
        if (updated !== s) {
          this.bus.emit('expedition_launch', { scouts, warriors, destination: dest.name });
        }
        this.setState(updated);
      });
      card.appendChild(btn);
      grid.appendChild(card);
    }
    this.container.appendChild(grid);

    // Active expeditions
    if (state.expeditions.length > 0) {
      const activeTitle = document.createElement('div');
      activeTitle.className = 'expedition-list-title';
      activeTitle.textContent = 'Active:';
      this.container.appendChild(activeTitle);

      for (const exp of state.expeditions) {
        this.container.appendChild(this.createExpeditionRow(exp));
      }
    }
  }

  private createExpeditionRow(exp: {
    id: string; scouts: number; warriors: number;
    destination: string; ticksRemaining: number; risk: number;
  }): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'expedition-row';

    const info = document.createElement('div');
    info.className = 'expedition-row-info';
    const party = [];
    if (exp.scouts > 0) party.push(`${exp.scouts}S`);
    if (exp.warriors > 0) party.push(`${exp.warriors}W`);
    const destStrong = document.createElement('strong');
    destStrong.textContent = exp.destination;
    info.appendChild(destStrong);
    info.appendChild(document.createTextNode(' '));
    const partySpan = document.createElement('span');
    partySpan.className = 'text-muted';
    partySpan.textContent = party.join(' ');
    info.appendChild(partySpan);
    row.appendChild(info);

    const status = document.createElement('div');
    status.className = 'expedition-row-status';
    const riskPct = Math.round(exp.risk * 100);
    const timeSpan = document.createElement('span');
    timeSpan.textContent = `⏳ ${exp.ticksRemaining}s`;
    status.appendChild(timeSpan);
    status.appendChild(document.createTextNode(' '));
    const riskSpan = document.createElement('span');
    riskSpan.className = `risk-${riskPct > 50 ? 'high' : 'low'}`;
    riskSpan.textContent = `Risk: ${riskPct}%`;
    status.appendChild(riskSpan);
    row.appendChild(status);

    return row;
  }

  private sendTooltip(state: GameState): string {
    const hasSoldiers = state.soldiers.scouts > 0 || state.soldiers.warriors > 0;
    const hasSlot = state.expeditions.length < MAX_ACTIVE_EXPEDITIONS;
    if (!hasSoldiers && !hasSlot) {
      return 'Requires scouts or warriors + available expedition slot';
    }
    if (!hasSoldiers) return 'Requires scouts or warriors';
    if (!hasSlot) return `All ${MAX_ACTIVE_EXPEDITIONS} expeditions active`;
    return 'Cannot launch';
  }

  getElement(): HTMLDivElement { return this.container; }
}
