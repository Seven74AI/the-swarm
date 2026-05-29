import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import { formatNumber } from '../../utils/format';

/**
 * CombatLogPanel — battle history display visible in COMBAT phase and beyond.
 *
 * Shows the most recent battle outcome (enemy type, result, soldiers lost,
 * food gained). When no battle has been fought yet, displays a placeholder.
 * Reactive via @preact/signals-core — updates automatically when lastBattle
 * changes.
 */
export class CombatLogPanel {
  private container: HTMLDivElement;
  private contentArea: HTMLDivElement;
  private enemyTypeEl: HTMLSpanElement;
  private resultEl: HTMLSpanElement;
  private soldiersLostEl: HTMLSpanElement;
  private foodGainedEl: HTMLSpanElement;
  private timestampEl: HTMLSpanElement;
  private emptyState: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'combat-log-panel';
    this.container.className = 'panel combat-log-panel';
    this.container.style.display = 'none'; // Hidden until COMBAT phase

    // Title
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '📜 Combat Log';
    this.container.appendChild(title);

    // --- Empty state (shown when no battles yet) ---
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'combat-log-empty';
    this.emptyState.textContent = 'No battles fought yet. Scout an enemy and engage!';
    this.emptyState.style.display = 'none';
    this.container.appendChild(this.emptyState);

    // --- Content area (shown when a battle exists) ---
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'combat-log-content';
    this.contentArea.style.display = 'none';

    // Enemy type row
    const enemyRow = document.createElement('div');
    enemyRow.className = 'stat-row';
    const enemyLabel = document.createElement('span');
    enemyLabel.className = 'stat-label';
    enemyLabel.textContent = 'Last Enemy: ';
    this.enemyTypeEl = document.createElement('span');
    this.enemyTypeEl.className = 'stat-value';
    enemyRow.appendChild(enemyLabel);
    enemyRow.appendChild(this.enemyTypeEl);
    this.contentArea.appendChild(enemyRow);

    // Result row
    const resultRow = document.createElement('div');
    resultRow.className = 'stat-row';
    const resultLabel = document.createElement('span');
    resultLabel.className = 'stat-label';
    resultLabel.textContent = 'Result: ';
    this.resultEl = document.createElement('span');
    this.resultEl.className = 'stat-value';
    resultRow.appendChild(resultLabel);
    resultRow.appendChild(this.resultEl);
    this.contentArea.appendChild(resultRow);

    // Soldiers lost row
    const soldiersRow = document.createElement('div');
    soldiersRow.className = 'stat-row';
    const soldiersLabel = document.createElement('span');
    soldiersLabel.className = 'stat-label';
    soldiersLabel.textContent = 'Soldiers Lost: ';
    this.soldiersLostEl = document.createElement('span');
    this.soldiersLostEl.className = 'stat-value';
    soldiersRow.appendChild(soldiersLabel);
    soldiersRow.appendChild(this.soldiersLostEl);
    this.contentArea.appendChild(soldiersRow);

    // Food gained row
    const foodRow = document.createElement('div');
    foodRow.className = 'stat-row';
    const foodLabel = document.createElement('span');
    foodLabel.className = 'stat-label';
    foodLabel.textContent = 'Food Gained: ';
    this.foodGainedEl = document.createElement('span');
    this.foodGainedEl.className = 'stat-value';
    foodRow.appendChild(foodLabel);
    foodRow.appendChild(this.foodGainedEl);
    this.contentArea.appendChild(foodRow);

    // Timestamp row
    const timeRow = document.createElement('div');
    timeRow.className = 'stat-row';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'stat-label';
    timeLabel.textContent = 'When: ';
    this.timestampEl = document.createElement('span');
    this.timestampEl.className = 'stat-sub';
    timeRow.appendChild(timeLabel);
    timeRow.appendChild(this.timestampEl);
    this.contentArea.appendChild(timeRow);

    this.container.appendChild(this.contentArea);

    // Reactive: auto-refresh when lastBattle changes
    effect(() => {
      const s = gameState.value;
      void s.lastBattle;
      this.refresh();
    });

    // Initial render
    this.refresh();
  }

  /**
   * Format a timestamp as relative time (e.g. "Just now", "2 min ago").
   */
  private formatTimeAgo(ts: number): string {
    const diffSec = Math.round((Date.now() - ts) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  /**
   * Returns the display text for a battle result.
   */
  private formatResult(result: string): string {
    switch (result) {
      case 'victory': return '🏆 Victory';
      case 'defeat': return '💀 Defeat';
      default: return result;
    }
  }

  private refresh(): void {
    const lastBattle = gameState.value.lastBattle;

    if (!lastBattle) {
      this.emptyState.style.display = '';
      this.contentArea.style.display = 'none';
      return;
    }

    this.emptyState.style.display = 'none';
    this.contentArea.style.display = '';

    this.enemyTypeEl.textContent = lastBattle.enemyType ?? 'Unknown';
    this.resultEl.textContent = this.formatResult(lastBattle.result);
    this.soldiersLostEl.textContent = formatNumber(lastBattle.soldiersLost);
    this.foodGainedEl.textContent = `+${formatNumber(lastBattle.foodGained)}`;
    this.timestampEl.textContent = this.formatTimeAgo(lastBattle.timestamp);
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
