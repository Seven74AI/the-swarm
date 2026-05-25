import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import {
  isPrestigeAvailable,
  getUnmetRequirements,
  calculateLegacyPoints,
  prestige as doPrestige,
  canBuyTemporalResonance,
  buyTemporalResonance,
  TEMPORAL_RESONANCE_COST,
  canBuyChronoSynchronization,
  buyChronoSynchronization,
  CHRONO_SYNCHRONIZATION_COST,
} from '../../systems/PrestigeSystem';

/**
 * PrestigePanel — Legacy Layer UI.
 *
 * Shows:
 *  - Current Legacy Points count
 *  - Prestige count ("Legacy N")
 *  - Projected Legacy Points for next reset
 *  - Legacy button (greyed → glowing → clickable)
 *
 * Uses @preact/signals-core for reactivity.
 */
export class PrestigePanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'prestige-panel';
    this.container.className = 'panel prestige-panel';

    this.render();

    // Reactive: auto-refresh when prestige data changes
    effect(() => {
      void gameState.value.prestige;
      void gameState.value.buildings;
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
    const available = isPrestigeAvailable(state);
    const unmet = getUnmetRequirements(state);
    const { count, legacyPoints, totalFoodProduced } = state.prestige;

    // Compute projected points for this reset
    // phaseScore: sum of all reached phase numbers
    const phaseNum = getPhaseNumber(state.phase);
    const phaseScore = sumToN(phaseNum);
    const projected = calculateLegacyPoints(totalFoodProduced, phaseScore);

    this.container.innerHTML = '';

    // ── Title ──
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '✨ Legacy Prestige';
    this.container.appendChild(title);

    // ── Legacy Points display ──
    const pointsRow = document.createElement('div');
    pointsRow.className = 'stat-row';
    const pointsLabel = document.createElement('span');
    pointsLabel.className = 'stat-label';
    pointsLabel.textContent = '🏆 Legacy Points';
    const pointsValue = document.createElement('span');
    pointsValue.className = 'stat-value';
    pointsValue.textContent = String(legacyPoints);
    pointsRow.appendChild(pointsLabel);
    pointsRow.appendChild(pointsValue);
    this.container.appendChild(pointsRow);

    // ── Prestige count ──
    const countRow = document.createElement('div');
    countRow.className = 'stat-row';
    const countLabel = document.createElement('span');
    countLabel.className = 'stat-label';
    countLabel.textContent = '🔄 Legacy';
    const countValue = document.createElement('span');
    countValue.className = 'stat-value';
    countValue.textContent = String(count);
    countRow.appendChild(countLabel);
    countRow.appendChild(countValue);
    this.container.appendChild(countRow);

    // ── Prestige Tree button ──
    const treeBtn = document.createElement('button');
    treeBtn.className = 'btn btn-tree';
    treeBtn.textContent = '🌳 Prestige Tree';
    treeBtn.addEventListener('click', () => {
      this.bus.emit('open_prestige_tree', {});
    });
    this.container.appendChild(treeBtn);

    // ── Production bonus ──
    if (legacyPoints > 0) {
      const bonusRow = document.createElement('div');
      bonusRow.className = 'stat-row';
      const bonusLabel = document.createElement('span');
      bonusLabel.className = 'stat-label';
      bonusLabel.textContent = '⚡ Production Bonus';
      const bonusValue = document.createElement('span');
      bonusValue.className = 'stat-value';
      bonusValue.textContent = `+${legacyPoints * 2}%`;
      bonusRow.appendChild(bonusLabel);
      bonusRow.appendChild(bonusValue);
      this.container.appendChild(bonusRow);
    }

    // ── Offline Efficiency display ──
    const effRow = document.createElement('div');
    effRow.className = 'stat-row';
    const effLabel = document.createElement('span');
    effLabel.className = 'stat-label';
    effLabel.textContent = '⏳ Offline Efficiency';
    const effValue = document.createElement('span');
    effValue.className = 'stat-value';
    effValue.textContent = `${Math.round(state.offlineEfficiency * 100)}%`;
    effRow.appendChild(effLabel);
    effRow.appendChild(effValue);
    this.container.appendChild(effRow);

    // ── Temporal Resonance upgrade button (50% → 75%, cost: 10 LP) ──
    const canBuyTR = canBuyTemporalResonance(state);
    const trBtn = document.createElement('button');
    trBtn.className = 'btn btn-upgrade';
    trBtn.textContent = `🌀 Temporal Resonance (${Math.round(state.offlineEfficiency * 100)}% → 75%) — ${TEMPORAL_RESONANCE_COST} LP`;
    trBtn.disabled = !canBuyTR;
    if (canBuyTR) {
      trBtn.addEventListener('click', () => {
        const result = buyTemporalResonance(this.getState());
        if (result) this.setState(result);
      });
    } else if (state.offlineEfficiency !== 0.5) {
      trBtn.setAttribute('title', 'Already purchased');
    } else {
      trBtn.setAttribute('title', `Requires ${TEMPORAL_RESONANCE_COST} Legacy Points`);
    }
    this.container.appendChild(trBtn);

    // ── Chrono-Synchronization upgrade button (75% → 100%, cost: 5 voidCrystals) ──
    const canBuyCS = canBuyChronoSynchronization(state);
    const csBtn = document.createElement('button');
    csBtn.className = 'btn btn-upgrade';
    csBtn.textContent = `🔮 Chrono-Synchronization (${Math.round(state.offlineEfficiency * 100)}% → 100%) — ${CHRONO_SYNCHRONIZATION_COST} ◈`;
    csBtn.disabled = !canBuyCS;
    if (canBuyCS) {
      csBtn.addEventListener('click', () => {
        const result = buyChronoSynchronization(this.getState());
        if (result) this.setState(result);
      });
    } else if (state.offlineEfficiency === 1.0) {
      csBtn.setAttribute('title', 'Max efficiency reached');
    } else if (state.offlineEfficiency !== 0.75) {
      csBtn.setAttribute('title', 'Requires Temporal Resonance first');
    } else {
      csBtn.setAttribute('title', `Requires ${CHRONO_SYNCHRONIZATION_COST} void crystals`);
    }
    this.container.appendChild(csBtn);

    // ── Projected points ──
    const projRow = document.createElement('div');
    projRow.className = 'stat-row projected';
    const projLabel = document.createElement('span');
    projLabel.className = 'stat-label';
    projLabel.textContent = '📊 Next Reset';
    const projValue = document.createElement('span');
    projValue.className = 'stat-value';
    projValue.textContent = available
      ? `+${projected} LP`
      : '—';
    projRow.appendChild(projLabel);
    projRow.appendChild(projValue);
    this.container.appendChild(projRow);

    // ── Legacy button ──
    const btn = document.createElement('button');
    btn.className = 'btn btn-prestige';
    btn.textContent = '⚡ Transcend';
    btn.disabled = !available;

    if (available) {
      // Glowing state: requirements met, ready to prestige
      btn.classList.add('prestige-ready');
    } else {
      // Greyed-out state with tooltip
      const tooltip = `Your colony has reached the limits of physics. Only transcendence can break these bonds.\n\nRequirements:\n${unmet.map((u) => `  ✗ ${u}`).join('\n')}`;
      btn.setAttribute('title', tooltip);
    }

    btn.addEventListener('click', () => {
      if (!available) return;
      const current = this.getState();
      const reset = doPrestige(current);
      this.bus.emit('prestige_triggered', {
        fromCount: current.prestige.count,
        toCount: reset.prestige.count,
        legacyPointsGained: reset.prestige.legacyPoints - current.prestige.legacyPoints,
        totalLegacyPoints: reset.prestige.legacyPoints,
      });
      this.setState(reset);
    });

    this.container.appendChild(btn);
  }
}

/**
 * Get the numeric position of a phase (1-6).
 */
function getPhaseNumber(phase: string): number {
  const map: Record<string, number> = {
    egg_laying: 1,
    colony: 2,
    combat: 3,
    expansion: 4,
    space: 5,
    transcendence: 6,
  };
  return map[phase] ?? 1;
}

/**
 * Sum 1 + 2 + ... + n.
 */
function sumToN(n: number): number {
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    sum += i;
  }
  return sum;
}
