import { effect, untracked, type ReadonlySignal } from '@preact/signals-core';
import { h, render as renderPreact } from 'preact';
import {
  selectPrestige,
  selectBuildings,
  selectOfflineEfficiency,
  selectPhase,
} from '../../state/selectors';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import {
  isPrestigeAvailable,
  getUnmetRequirements,
  calculateLegacyPoints,
  getPhaseScore,
  canBuyTemporalResonance,
  TEMPORAL_RESONANCE_COST,
  canBuyChronoSynchronization,
  CHRONO_SYNCHRONIZATION_COST,
} from '../../state/queries';
import type { Actions } from '../../actions';
import { explain } from '../components/refusal';
import { HoldToConfirm, type ConfirmSettings } from '../primitives/HoldToConfirm';

/**
 * PrestigePanel — Legacy Layer UI.
 *
 * Shows:
 *  - Current Legacy Points count
 *  - Prestige count ("Legacy N")
 *  - Projected Legacy Points for next reset
 *  - Legacy button (greyed → glowing → hold-to-confirm, Story 1.13)
 *
 * The prestige control is a `HoldToConfirm` in its own Preact root
 * (`confirmHost`), outside the rebuilt markup, so a re-render never drops a hold.
 *
 * Uses @preact/signals-core for reactivity.
 */
export class PrestigePanel {
  private container: HTMLDivElement;
  private body: HTMLDivElement;
  private confirmHost: HTMLDivElement;
  private lastMarkup: string | null = null;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private actions: Actions,
    /** Confirm style and hold duration from the platform settings, passed in from main. */
    private confirmSettings: ReadonlySignal<ConfirmSettings>,
  ) {
    this.container = document.createElement('div');
    this.body = document.createElement('div');
    this.confirmHost = document.createElement('div');
    this.confirmHost.className = 'prestige-confirm';
    this.container.id = 'prestige-panel';
    this.container.className = 'panel prestige-panel';
    this.container.setAttribute('data-tooltip',
      'Legacy Prestige: Reset your colony to earn Legacy Points. Each Legacy Point gives +2% production. Buildings, phases, and food produced determine your legacy.');
    this.container.append(this.body, this.confirmHost);

    this.render();

    // Reactive: auto-refresh when prestige data changes
    effect(() => {
      void selectPrestige.value;
      void selectBuildings.value;
      void selectOfflineEfficiency.value;
      void selectPhase.value;
      // Render reads through getState(); keep it from subscribing to the whole state.
      untracked(() => this.render());
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
    // Same scoring prestige() uses, so the preview can't drift from the award.
    const projected = calculateLegacyPoints(totalFoodProduced, getPhaseScore(state.phase));

    // Build into a scratch root and swap only when the markup changed: the effect
    // re-runs on every tick (#186), and rebuilding the button 20×/s can eat a tap.
    const root = document.createElement('div');

    // ── Title ──
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '✨ Legacy Prestige';
    root.appendChild(title);

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
    root.appendChild(pointsRow);

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
    root.appendChild(countRow);

    // ── Prestige Tree button ──
    const treeBtn = document.createElement('button');
    treeBtn.className = 'btn btn-tree';
    treeBtn.textContent = '🌳 Prestige Tree';
    treeBtn.addEventListener('click', () => {
      this.bus.emit('open_prestige_tree', {});
    });
    root.appendChild(treeBtn);

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
      root.appendChild(bonusRow);
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
    root.appendChild(effRow);

    // ── Temporal Resonance upgrade button (50% → 75%, cost: 10 LP) ──
    const canBuyTR = canBuyTemporalResonance(state);
    const trBtn = document.createElement('button');
    trBtn.className = 'btn btn-upgrade';
    trBtn.textContent = `🌀 Temporal Resonance (${Math.round(state.offlineEfficiency * 100)}% → 75%) — ${TEMPORAL_RESONANCE_COST} LP`;
    trBtn.disabled = !canBuyTR;
    if (canBuyTR) {
      trBtn.addEventListener('click', () => {
        explain(trBtn, this.actions.buyTemporalResonance());
      });
    } else if (state.offlineEfficiency !== 0.5) {
      trBtn.setAttribute('title', 'Already purchased');
    } else {
      trBtn.setAttribute('title', `Requires ${TEMPORAL_RESONANCE_COST} Legacy Points`);
    }
    root.appendChild(trBtn);

    // ── Chrono-Synchronization upgrade button (75% → 100%, cost: 5 voidCrystals) ──
    const canBuyCS = canBuyChronoSynchronization(state);
    const csBtn = document.createElement('button');
    csBtn.className = 'btn btn-upgrade';
    csBtn.textContent = `🔮 Chrono-Synchronization (${Math.round(state.offlineEfficiency * 100)}% → 100%) — ${CHRONO_SYNCHRONIZATION_COST} ◈`;
    csBtn.disabled = !canBuyCS;
    if (canBuyCS) {
      csBtn.addEventListener('click', () => {
        explain(csBtn, this.actions.buyChronoSynchronization());
      });
    } else if (state.offlineEfficiency === 1.0) {
      csBtn.setAttribute('title', 'Max efficiency reached');
    } else if (state.offlineEfficiency !== 0.75) {
      csBtn.setAttribute('title', 'Requires Temporal Resonance first');
    } else {
      csBtn.setAttribute('title', `Requires ${CHRONO_SYNCHRONIZATION_COST} void crystals`);
    }
    root.appendChild(csBtn);

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
    root.appendChild(projRow);

    // ── Legacy button: irreversible, so it needs a hold or two taps (Story 1.13) ──
    const tooltip = available
      ? undefined
      : `Your colony has reached the limits of physics. Only transcendence can break these bonds.\n\nRequirements:\n${unmet.map((u) => `  ✗ ${u}`).join('\n')}`;
    renderPreact(
      h(HoldToConfirm, {
        verb: 'Transcend',
        onConfirm: () => {
          // The action raises prestige_triggered after its write.
          const el = this.confirmHost.querySelector('button');
          return explain(el, this.actions.prestige());
        },
        settings: this.confirmSettings,
        disabled: available ? false : 'requirements not met',
        class: available ? 'btn-prestige prestige-ready' : 'btn-prestige',
        title: tooltip,
        'data-action': 'prestige',
      }),
      this.confirmHost,
    );

    if (root.innerHTML === this.lastMarkup) return;
    this.lastMarkup = root.innerHTML;
    this.body.replaceChildren(...Array.from(root.childNodes));
  }
}
