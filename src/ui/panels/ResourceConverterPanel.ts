import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import {
  getConversionDefs,
  isConversionUnlocked,
  getConversionRate,
  tickConversions,
  type ConversionDef,
} from '../../systems/ResourceConversionSystem';
import { formatNumber } from '../../utils/format';

/** Icons for each conversion step. */
const CONVERSION_ICONS: Record<string, string> = {
  voidCrystalSynthesis: '🔮',
  antimatterContainment: '⚛️',
  darkMatterDetection: '🕳️',
};

/** Human-readable requirement descriptions for locked conversions. */
function getUnlockHint(def: ConversionDef, state: GameState): string {
  if (!state.research.projects[def.requiredResearch] ||
    state.research.projects[def.requiredResearch].state !== 'completed') {
    return 'Research required';
  }
  if (!def.isReady(state)) {
    if (def.id === 'antimatterContainment') return 'Build a Particle Lab';
    if (def.id === 'darkMatterDetection') return 'Launch a space exploration';
    return 'Not ready';
  }
  return '';
}

/**
 * ResourceConverterPanel — Phase 4 conversion UI.
 *
 * Displays the 3-step resource conversion DAG as a card grid:
 *   voidCrystals → antimatter → darkMatter
 *
 * Each card shows input costs, outputs, unlock status, and current rate.
 * A master "Convert" button triggers one tick of the conversion pipeline.
 *
 * Pattern: follows ExpeditionPanel/ExplorationPanel card-grid convention.
 */
export class ResourceConverterPanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'resource-converter-panel';
    this.container.className = 'panel resource-converter-panel';

    this.render();

    effect(() => {
      // Track all resources that could affect conversion state
      const s = gameState.value;
      void s.resources.stone;
      void s.resources.nectar;
      void s.resources.voidCrystals;
      void s.resources.antimatter;
      void s.resources.darkMatter;
      void s.workersAssigned.researchers;
      void s.conversions?.particleLab;
      void s.spaceExplorations?.length;
      void s.research;
      this.render();
    });
  }

  refresh(): void { this.render(); }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();
    const defs = getConversionDefs();
    const particleLab = state.conversions?.particleLab ?? 0;
    const anyUnlocked = defs.some((d) => isConversionUnlocked(state, d.id));

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<span class="panel-title">🔄 Resource Converter</span>
      <span class="panel-sub">Particle Lab: ${particleLab > 0 ? `Lv.${particleLab}` : 'Not built'}</span>`;
    this.container.appendChild(header);

    // Conversion cards
    const grid = document.createElement('div');
    grid.className = 'expedition-grid';

    for (const def of defs) {
      const card = document.createElement('div');
      card.className = 'expedition-card';

      const unlocked = isConversionUnlocked(state, def.id);
      const rate = getConversionRate(state, def.id);
      const hint = getUnlockHint(def, state);

      // Format input/output costs
      const inputs = Object.entries(def.inputs)
        .map(([r, a]) => `${a} ${r}`)
        .join(' + ');
      const outputs = Object.entries(def.outputs)
        .map(([r, a]) => `${a} ${r}`)
        .join(' + ');

      const icon = CONVERSION_ICONS[def.id] ?? '⚙️';
      const statusClass = unlocked ? 'expedition-card-type' : 'expedition-card-type';
      const statusText = unlocked
        ? (rate > 0 ? `Active · Rate: ${rate}/tick` : `Unlocked · Insufficient inputs`)
        : `🔒 ${hint}`;

      card.innerHTML = `<div class="expedition-card-icon">${icon}</div>
        <div class="expedition-card-name">${def.name}</div>
        <div class="expedition-card-loot">${inputs} → ${outputs}</div>
        <div class="${statusClass}">${statusText}</div>`;

      grid.appendChild(card);
    }
    this.container.appendChild(grid);

    // Master convert button
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '⚡ Process Conversions (1 tick)';
    btn.disabled = !anyUnlocked;
    btn.addEventListener('click', () => {
      const s = this.getState();
      const result = tickConversions(s, 1);
      if (result !== s) {
        this.bus.emit('conversion_tick', { tick: 1 });
      }
      this.setState(result);
    });
    btnRow.appendChild(btn);
    this.container.appendChild(btnRow);

    // DAG order hint
    const hint = document.createElement('div');
    hint.className = 'text-muted';
    hint.style.cssText = 'margin-top: 0.5rem; font-size: 0.7rem; text-align: center;';
    hint.textContent = 'Conversions run in DAG order: each step feeds the next.';
    this.container.appendChild(hint);
  }

  getElement(): HTMLDivElement { return this.container; }
}
