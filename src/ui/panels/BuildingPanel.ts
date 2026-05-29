import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { canBuild, build, getBuildCost, getEffects } from '../../systems/BuildingSystem';
import type { BuildingType } from '../../systems/BuildingSystem';

interface BuildingDef {
  type: BuildingType;
  label: string;
  icon: string;
  effectLabel: (level: number) => string;
}

const BUILDINGS: BuildingDef[] = [
  {
    type: 'barracks',
    label: 'Barracks',
    icon: '🏰',
    effectLabel: (level: number) => {
      const e = getEffects('barracks', level);
      return e.warriorsCap! > 0
        ? `Scouts: ${e.scoutsCap}, Warriors: ${e.warriorsCap}`
        : `Scouts cap: ${e.scoutsCap ?? 0}`;
    },
  },
  {
    type: 'walls',
    label: 'Walls',
    icon: '🧱',
    effectLabel: (level: number) => {
      const e = getEffects('walls', level);
      return `Defense: +${Math.round(((e.defenseBonus ?? 0) * 100))}%`;
    },
  },
  {
    type: 'warehouse',
    label: 'Warehouse',
    icon: '🏪',
    effectLabel: (level: number) => {
      const e = getEffects('warehouse', level);
      return `Capacity: +${e.nestCapacity ?? 0}`;
    },
  },
];

/**
 * BuildingPanel shows building list with levels, costs, and Build buttons.
 */
export class BuildingPanel {
  private container: HTMLDivElement;
  private lastHash: string = '';

  constructor(
    private bus: EventBus,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'building-panel';
    this.container.className = 'panel building-panel';

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🏗️ Buildings';
    this.container.appendChild(title);

    for (const def of BUILDINGS) {
      this.container.appendChild(this.createBuildingRow(def));
    }

    // Reactive: auto-refresh when buildings change
    effect(() => {
      void gameState.value.buildings;
      this.refresh();
    });
  }

  private createBuildingRow(def: BuildingDef): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.setAttribute('data-building', def.type);

    const label = document.createElement('span');
    label.className = 'stat-label';
    const state = this.getState();
    const level = state.buildings[def.type].level;
    label.textContent = `${def.icon} ${def.label} (Lv.${level})`;
    row.appendChild(label);

    const info = document.createElement('span');
    info.className = 'building-info';
    info.textContent = def.effectLabel(level);
    row.appendChild(info);

    const costSpan = document.createElement('span');
    costSpan.className = 'building-cost';
    costSpan.textContent = this.formatCost(def.type);
    row.appendChild(costSpan);

    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.textContent = 'Build';
    btn.disabled = !canBuild(def.type, state);
    if (btn.disabled) {
      btn.setAttribute('data-tooltip', this.buildCostTooltip(def.type, state));
    }
    btn.addEventListener('click', () => {
      const s = this.getState();
      const oldLevel = s.buildings[def.type].level;
      const updated = build(def.type, s);
      if (updated.buildings[def.type].level > oldLevel) {
        this.bus.emit('building_complete', { building: def.type, level: updated.buildings[def.type].level });
      }
      this.setState(updated);
    });
    row.appendChild(btn);

    return row;
  }

  private formatCost(building: BuildingType): string {
    const state = this.getState();
    const nextLevel = state.buildings[building].level + 1;
    const cost = getBuildCost(building, nextLevel);
    const parts: string[] = [];
    if (cost.food > 0) parts.push(`🍞${cost.food}`);
    if (cost.wood > 0) parts.push(`🪵${cost.wood}`);
    if (cost.stone > 0) parts.push(`🪨${cost.stone}`);
    if (cost.nectar > 0) parts.push(`🍯${cost.nectar}`);
    return parts.join(' ');
  }

  private buildCostTooltip(building: BuildingType, state: GameState): string {
    const nextLevel = state.buildings[building].level + 1;
    const cost = getBuildCost(building, nextLevel);
    const missing: string[] = [];
    if (cost.food > 0 && state.resources.food < cost.food) missing.push(`🍞${cost.food - state.resources.food} food`);
    if (cost.wood > 0 && state.resources.wood < cost.wood) missing.push(`🪵${cost.wood - state.resources.wood} wood`);
    if (cost.stone > 0 && state.resources.stone < cost.stone) missing.push(`🪨${cost.stone - state.resources.stone} stone`);
    if (cost.nectar > 0 && state.resources.nectar < cost.nectar) missing.push(`🍯${cost.nectar - state.resources.nectar} nectar`);
    if (missing.length > 0) return `Need: ${missing.join(', ')}`;
    return 'Cannot build';
  }

  private refresh(): void {
    // Compute hash of building state to skip re-render when unchanged
    const state = this.getState();
    const hash = BUILDINGS.map(d => {
      const b = state.buildings[d.type];
      return `${d.type}:${b.level}:${canBuild(d.type, state)}`;
    }).join('|');

    if (hash === this.lastHash) return;
    this.lastHash = hash;

    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🏗️ Buildings';
    this.container.appendChild(title);

    for (const def of BUILDINGS) {
      this.container.appendChild(this.createBuildingRow(def));
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
