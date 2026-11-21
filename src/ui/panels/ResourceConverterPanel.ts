import { effect, untracked } from '@preact/signals-core';
import {
  selectByPath,
  selectConversions,
  selectResearch,
  selectResearchers,
  selectSpaceExplorations,
} from '../../state/selectors';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import {
  getConversionDefs,
  isConversionUnlocked,
  getConversionRate,
  type ConversionDef,
} from '../../state/queries';
import type { Actions } from '../../actions';
import { explain } from '../components/refusal';

/** Resources whose amounts change what the converter shows (each tracked as its own slice). */
const TRACKED_RESOURCES = ['stone', 'nectar', 'voidCrystals', 'antimatter', 'darkMatter'] as const;

/** Icons for each conversion step. */
const CONVERSION_ICONS: Record<string, string> = {
  voidCrystalSynthesis: '🔮',
  antimatterContainment: '⚛️',
  darkMatterDetection: '🕳️',
};

/** Human-readable requirement descriptions for locked conversions. */
function getUnlockHint(def: ConversionDef, state: GameState): string {
  if (!state.research.projects[def.requiredResearch] ||
    state.research.projects[def.requiredResearch].status !== 'done') {
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
    private actions: Actions,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'resource-converter-panel';
    this.container.className = 'panel resource-converter-panel';

    this.render();

    effect(() => {
      // Track all resources that could affect conversion state
      for (const r of TRACKED_RESOURCES) void selectByPath(`resources.${r}`).value;
      void selectResearchers.value;
      void selectConversions.value;
      void selectSpaceExplorations.value;
      void selectResearch.value;
      // render() reads through getState(); keep it from subscribing to the whole state.
      untracked(() => this.render());
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
      // The action raises conversion_tick after its write.
      explain(btn, this.actions.runConversions());
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
