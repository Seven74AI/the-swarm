import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { formatNumber } from '../../utils/format';

/**
 * TranscendencePanel — Endgame / victory screen.
 *
 * Displays transcendence status:
 *  - Whether victory has been achieved
 *  - Prestige stats (count, legacy points, total food produced)
 *
 * Uses @preact/signals-core for reactivity.
 */
export class TranscendencePanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'transcendence-panel';
    this.container.className = 'panel transcendence-panel';

    this.render();

    // Reactive: auto-refresh when victory or prestige data changes
    effect(() => {
      void gameState.value.victoryAchieved;
      void gameState.value.prestige;
      this.render();
    });
  }

  /** Public refresh for tests and manual updates. */
  refresh(): void {
    this.render();
  }

  getElement(): HTMLDivElement {
    return this.container;
  }

  private render(): void {
    const state = this.getState();
    const { victoryAchieved, prestige } = state;
    const { count, legacyPoints, totalFoodProduced } = prestige;

    this.container.innerHTML = '';

    // ── Title ──
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🌌 Transcendence';
    this.container.appendChild(title);

    // ── Victory status ──
    const statusSection = document.createElement('div');
    statusSection.className = 'transcendence-status';

    const statusLabel = document.createElement('div');
    statusLabel.className = 'transcendence-status-label';
    statusLabel.textContent = victoryAchieved
      ? '✨ You have transcended! ✨'
      : 'Reach the stars to transcend...';

    const statusDesc = document.createElement('div');
    statusDesc.className = 'transcendence-status-desc';
    statusDesc.textContent = victoryAchieved
      ? 'The swarm has collapsed into a singularity of pure thought. All boundaries have dissolved.'
      : 'Accumulate cosmic resources to achieve transcendence victory.';

    statusSection.appendChild(statusLabel);
    statusSection.appendChild(statusDesc);
    this.container.appendChild(statusSection);

    // ── Prestige stats ──
    const statsSection = document.createElement('div');
    statsSection.className = 'transcendence-stats';

    const statsTitle = document.createElement('div');
    statsTitle.className = 'transcendence-stats-title';
    statsTitle.textContent = 'Legacy Stats';
    statsSection.appendChild(statsTitle);

    const statEntries: Array<[string, string]> = [
      ['Prestige Count', String(count)],
      ['Legacy Points', formatNumber(legacyPoints)],
      ['Lifetime Food', formatNumber(totalFoodProduced)],
    ];

    for (const [label, value] of statEntries) {
      const row = document.createElement('div');
      row.className = 'stat-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'stat-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'stat-value';
      valueEl.textContent = value;

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      statsSection.appendChild(row);
    }

    this.container.appendChild(statsSection);
  }
}
