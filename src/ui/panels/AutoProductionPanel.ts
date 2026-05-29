import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import {
  type ResearchType,
  type AutomationBuildingType,
  RESEARCHES,
  AUTOMATION_BUILDINGS,
  canResearch,
  research,
  canBuildAuto,
  buildAuto,
  getAutoEggRate,
  getAutoBuildCost,
  getBuildingEffect,
} from '../../systems/AutomationSystem';

/**
 * AutoProductionPanel — Paperclip-style automation UI.
 *
 * Shows:
 * - Auto-production toggle
 * - Current auto egg rate (eggs/s)
 * - Research tree with prerequisites, costs, and Research buttons
 * - Automation buildings with levels, costs, and Build buttons
 *
 * Reactive via @preact/signals-core effect().
 */
export class AutoProductionPanel {
  private container: HTMLDivElement;

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'automation-panel';
    this.container.className = 'panel automation-panel';

    this.build();

    // Reactive refresh when automation state changes
    effect(() => {
      void gameState.value.autoProduction;
      this.build();
    });
  }

  /** Public refresh for tests and manual updates. */
  refresh(): void {
    this.build();
  }

  private build(): void {
    this.container.innerHTML = '';

    const state = this.getState();

    // ── Title + Toggle ──
    const header = document.createElement('div');
    header.className = 'panel-header';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '⚙️ Automation';
    header.appendChild(title);

    const toggleRow = document.createElement('label');
    toggleRow.className = 'auto-toggle-label';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'auto-toggle';
    toggle.checked = state.autoProduction.enabled;
    toggle.addEventListener('change', () => {
      const s = this.getState();
      this.setState({
        ...s,
        autoProduction: {
          ...s.autoProduction,
          enabled: toggle.checked,
        },
      });
    });
    toggleRow.appendChild(toggle);
    toggleRow.appendChild(document.createTextNode(' Auto-produce eggs'));
    header.appendChild(toggleRow);

    this.container.appendChild(header);

    // ── Rate display ──
    const rate = state.autoProduction.enabled ? getAutoEggRate(state) : 0;
    const rateDisplay = document.createElement('div');
    rateDisplay.className = 'auto-rate';
    rateDisplay.innerHTML = `Auto rate: <strong>${rate.toFixed(1)} eggs/s</strong>`;
    this.container.appendChild(rateDisplay);

    // ── Research tree ──
    const researchSection = document.createElement('div');
    researchSection.className = 'research-section';

    const researchTitle = document.createElement('div');
    researchTitle.className = 'section-title';
    researchTitle.textContent = '🔬 Research';
    researchSection.appendChild(researchTitle);

    for (const researchId of Object.keys(RESEARCHES) as ResearchType[]) {
      const def = RESEARCHES[researchId];
      const unlocked = state.autoProduction.researches[researchId] === true;
      const affordable = canResearch(researchId, state);

      const row = document.createElement('div');
      row.className = `research-row ${unlocked ? 'researched' : ''}`;
      row.setAttribute('data-research', researchId);

      const label = document.createElement('span');
      label.className = 'research-label';
      if (unlocked) {
        label.textContent = `✅ ${def.name}`;
      } else if (affordable) {
        label.textContent = `🔓 ${def.name}`;
      } else {
        label.textContent = `🔒 ${def.name}`;
      }
      row.appendChild(label);

      if (!unlocked) {
        const cost = def.cost;
        const costParts: string[] = [];
        if (cost.food) costParts.push(`🍞${cost.food}`);
        if (cost.workers) costParts.push(`🐜${cost.workers}`);
        if (cost.stone) costParts.push(`🪨${cost.stone}`);
        if (cost.voidCrystals) costParts.push(`💎${cost.voidCrystals}`);
        if (cost.antimatter) costParts.push(`⚛${cost.antimatter}`);
        const costSpan = document.createElement('span');
        costSpan.className = 'research-cost';
        costSpan.textContent = costParts.join(' ');
        row.appendChild(costSpan);

        const btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.textContent = 'Research';
        btn.disabled = !affordable;
        btn.addEventListener('click', () => {
          const s = this.getState();
          const result = research(researchId, s);
          if (result.autoProduction.researches[researchId]) {
            this.bus.emit('research_complete', { research: researchId });
          }
          this.setState(result);
        });
        row.appendChild(btn);
      } else {
        // Show effect
        const effectSpan = document.createElement('span');
        effectSpan.className = 'research-effect';
        const eff = def.effect;
        const effParts: string[] = [];
        if (eff.autoEggRate) effParts.push(`+${eff.autoEggRate} eggs/s`);
        if (eff.hatchBonus) effParts.push(`+${eff.hatchBonus}% hatch`);
        if (eff.multiplier) effParts.push(`×${eff.multiplier} production`);
        effectSpan.textContent = effParts.join(' | ');
        row.appendChild(effectSpan);
      }

      researchSection.appendChild(row);
    }

    this.container.appendChild(researchSection);

    // ── Buildings ──
    const buildingSection = document.createElement('div');
    buildingSection.className = 'building-section';

    const buildingTitle = document.createElement('div');
    buildingTitle.className = 'section-title';
    buildingTitle.textContent = '🏗️ Buildings';
    buildingSection.appendChild(buildingTitle);

    for (const buildingId of ['nursery', 'hatchery', 'queens_chamber'] as AutomationBuildingType[]) {
      const def = AUTOMATION_BUILDINGS[buildingId];
      const level = state.autoProduction.buildings[buildingId] ?? 0;
      const effect = getBuildingEffect(buildingId, level);
      const canBuild = canBuildAuto(buildingId, state);

      const row = document.createElement('div');
      row.className = 'auto-building-row';
      row.setAttribute('data-building', buildingId);

      const label = document.createElement('span');
      label.className = 'building-label';
      label.textContent = `🏠 ${def.name} (Lv.${level})`;

      const info = document.createElement('span');
      info.className = 'building-info';
      const infoParts: string[] = [];
      if (effect.autoEggRate) infoParts.push(`+${effect.autoEggRate} eggs/s`);
      if (effect.multiplier) infoParts.push(`×${effect.multiplier.toFixed(1)}`);
      if (effect.efficiency) infoParts.push(`+${(effect.efficiency * 100).toFixed(0)}% eff.`);
      info.textContent = infoParts.join(' | ');
      row.appendChild(label);
      row.appendChild(info);

      if (level < def.maxLevel) {
        const cost = getAutoBuildCost(buildingId, level + 1);
        const costParts: string[] = [];
        if (cost.food) costParts.push(`🍞${cost.food}`);
        if (cost.wood) costParts.push(`🪵${cost.wood}`);
        if (cost.stone) costParts.push(`🪨${cost.stone}`);
        if (cost.nectar) costParts.push(`🍯${cost.nectar}`);
        if (cost.voidCrystals) costParts.push(`💎${cost.voidCrystals}`);
        if (cost.antimatter) costParts.push(`⚛${cost.antimatter}`);

        const costSpan = document.createElement('span');
        costSpan.className = 'building-cost';
        costSpan.textContent = costParts.join(' ');
        row.appendChild(costSpan);

        const btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.textContent = 'Build';
        btn.disabled = !canBuild;
        btn.addEventListener('click', () => {
          const s = this.getState();
          const oldLevel = s.autoProduction.buildings[buildingId] ?? 0;
          const result = buildAuto(buildingId, s);
          if ((result.autoProduction.buildings[buildingId] ?? 0) > oldLevel) {
            this.bus.emit('auto_building_complete', { building: buildingId, level: result.autoProduction.buildings[buildingId] });
          }
          this.setState(result);
        });
        row.appendChild(btn);
      } else {
        const maxLabel = document.createElement('span');
        maxLabel.className = 'building-max';
        maxLabel.textContent = '(MAX)';
        row.appendChild(maxLabel);
      }

      buildingSection.appendChild(row);
    }

    this.container.appendChild(buildingSection);
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
