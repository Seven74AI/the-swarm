import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import type { SoldierSystem } from '../../systems/SoldierSystem';
import {
  SOLDIER_COST_FOOD,
  SOLDIER_TRAIN_TIME,
  MAX_EQUIPMENT_LEVEL,
  getSoldierStrength,
  getSoldierDefense,
  getSoldierSpeed,
  getSoldierMaxHp,
} from '../../systems/SoldierSystem';
import { upgradeCost } from '../../utils/math';
import { formatNumber } from '../../utils/format';

/**
 * Soldier Command panel.
 * Visibility controlled by PhaseContent — shown when COMBAT phase is active.
 */
export class SoldierPanel {
  private container: HTMLDivElement;
  private recruitBtn: HTMLButtonElement;
  private weaponBtn: HTMLButtonElement;
  private armorBtn: HTMLButtonElement;
  private soldiersDisplay: HTMLSpanElement;
  private trainingDisplay: HTMLSpanElement;
  private workersDisplay: HTMLSpanElement;
  private weaponLevelDisplay: HTMLSpanElement;
  private armorLevelDisplay: HTMLSpanElement;
  private weaponCostDisplay: HTMLSpanElement;
  private armorCostDisplay: HTMLSpanElement;
  private strengthDisplay: HTMLSpanElement;
  private defenseDisplay: HTMLSpanElement;
  private speedDisplay: HTMLSpanElement;
  private hpDisplay: HTMLSpanElement;

  constructor(
    private bus: EventBus,
    private soldierSystem: SoldierSystem,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'soldier-panel';
    this.container.className = 'panel soldier-panel';
    this.container.style.display = 'none'; // Hidden until combat phase

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '\u2694\uFE0F Soldier Command';
    this.container.appendChild(title);

    // --- Available Workers ---
    const workersRow = document.createElement('div');
    workersRow.className = 'stat-row';
    const workersLabel = document.createElement('span');
    workersLabel.className = 'stat-label';
    workersLabel.textContent = 'Available Workers: ';
    this.workersDisplay = document.createElement('span');
    this.workersDisplay.className = 'stat-value';
    workersRow.appendChild(workersLabel);
    workersRow.appendChild(this.workersDisplay);
    this.container.appendChild(workersRow);

    // --- Soldiers ---
    const soldiersRow = document.createElement('div');
    soldiersRow.className = 'stat-row';
    const soldiersLabel = document.createElement('span');
    soldiersLabel.className = 'stat-label';
    soldiersLabel.textContent = 'Soldiers: ';
    this.soldiersDisplay = document.createElement('span');
    this.soldiersDisplay.className = 'stat-value';
    this.trainingDisplay = document.createElement('span');
    this.trainingDisplay.className = 'stat-sub';
    soldiersRow.appendChild(soldiersLabel);
    soldiersRow.appendChild(this.soldiersDisplay);
    soldiersRow.appendChild(this.trainingDisplay);
    this.container.appendChild(soldiersRow);

    // --- Recruit Button ---
    const recruitRow = document.createElement('div');
    recruitRow.className = 'upgrade-row';
    this.recruitBtn = document.createElement('button');
    this.recruitBtn.className = 'btn btn-primary';
    this.recruitBtn.textContent = `Recruit Soldier (${SOLDIER_COST_FOOD} food, ${SOLDIER_TRAIN_TIME}s)`;
    this.recruitBtn.addEventListener('click', () => {
      const state = this.getState();
      const oldCombat = state.combatSoldiers;
      const updated = this.soldierSystem.recruitSoldier(state);
      if (updated !== state) {
        const newSoldiers = updated.combatSoldiers - oldCombat;
        this.bus.emit('soldier_recruited', { type: 'soldier', count: newSoldiers });
        this.setState(updated);
      }
    });
    recruitRow.appendChild(this.recruitBtn);
    this.container.appendChild(recruitRow);

    // --- Equipment Section ---
    const equipTitle = document.createElement('div');
    equipTitle.className = 'panel-subtitle';
    equipTitle.textContent = 'Equipment';
    this.container.appendChild(equipTitle);

    // Weapon row
    const weaponRow = document.createElement('div');
    weaponRow.className = 'upgrade-row';
    this.weaponLevelDisplay = document.createElement('span');
    this.weaponLevelDisplay.className = 'stat-label';
    this.weaponBtn = document.createElement('button');
    this.weaponBtn.className = 'btn btn-sm';
    this.weaponBtn.textContent = 'Upgrade';
    this.weaponBtn.addEventListener('click', () => {
      const state = this.getState();
      const updated = this.soldierSystem.upgradeWeapon(state);
      if (updated !== state) {
        this.setState(updated);
      }
    });
    this.weaponCostDisplay = document.createElement('span');
    this.weaponCostDisplay.className = 'stat-sub';
    weaponRow.appendChild(this.weaponLevelDisplay);
    weaponRow.appendChild(this.weaponBtn);
    weaponRow.appendChild(this.weaponCostDisplay);
    this.container.appendChild(weaponRow);

    // Armor row
    const armorRow = document.createElement('div');
    armorRow.className = 'upgrade-row';
    this.armorLevelDisplay = document.createElement('span');
    this.armorLevelDisplay.className = 'stat-label';
    this.armorBtn = document.createElement('button');
    this.armorBtn.className = 'btn btn-sm';
    this.armorBtn.textContent = 'Upgrade';
    this.armorBtn.addEventListener('click', () => {
      const state = this.getState();
      const updated = this.soldierSystem.upgradeArmor(state);
      if (updated !== state) {
        this.setState(updated);
      }
    });
    this.armorCostDisplay = document.createElement('span');
    this.armorCostDisplay.className = 'stat-sub';
    armorRow.appendChild(this.armorLevelDisplay);
    armorRow.appendChild(this.armorBtn);
    armorRow.appendChild(this.armorCostDisplay);
    this.container.appendChild(armorRow);

    // --- Stats Section ---
    const statsTitle = document.createElement('div');
    statsTitle.className = 'panel-subtitle';
    statsTitle.textContent = 'Stats';
    this.container.appendChild(statsTitle);

    const stats = [
      { label: 'Strength', ref: 'strength' },
      { label: 'Defense', ref: 'defense' },
      { label: 'Speed', ref: 'speed' },
      { label: 'HP', ref: 'hp' },
    ];

    const statDisplays: Record<string, HTMLSpanElement> = {};
    for (const s of stats) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const label = document.createElement('span');
      label.className = 'stat-label';
      label.textContent = s.label + ': ';
      const value = document.createElement('span');
      value.className = 'stat-value';
      statDisplays[s.ref] = value;
      row.appendChild(label);
      row.appendChild(value);
      this.container.appendChild(row);
    }
    this.strengthDisplay = statDisplays['strength'];
    this.defenseDisplay = statDisplays['defense'];
    this.speedDisplay = statDisplays['speed'];
    this.hpDisplay = statDisplays['hp'];

    // Reactive: auto-refresh when any soldier-related state changes
    effect(() => {
      // Read all relevant paths (tracked automatically by Signals)
      const s = gameState.value;
      void s.combatSoldiers;
      void s.soldierPipeline;
      void s.resources.workers;
      void s.resources.food;
      void s.equipment;
      void s.workersAssigned;
      this.refresh();
    });

    // Initial render
    this.refresh();
  }

  private refresh(): void {
    const state = this.getState();
    const assigned =
      state.workersAssigned.gather +
      state.workersAssigned.tend +
      state.workersAssigned.dig +
      state.workersAssigned.guard;
    const availableWorkers = Math.max(0, state.resources.workers - assigned);
    const trainCount = state.soldierPipeline.count;
    const weapon = state.equipment.weapon;
    const armor = state.equipment.armor;
    const food = state.resources.food;

    this.workersDisplay.textContent = formatNumber(availableWorkers);
    this.soldiersDisplay.textContent = formatNumber(state.combatSoldiers);
    this.trainingDisplay.textContent = trainCount > 0 ? ` [${formatNumber(trainCount)} in training]` : '';

    // Recruit button
    this.recruitBtn.disabled = availableWorkers < 1 || food < SOLDIER_COST_FOOD;

    // Weapon
    this.weaponLevelDisplay.textContent = `Weapons Lv.${weapon}`;
    const weaponCost = weapon >= MAX_EQUIPMENT_LEVEL ? 0 : upgradeCost(10, 1.20, weapon);
    this.weaponCostDisplay.textContent = weapon >= MAX_EQUIPMENT_LEVEL ? '' : ` ${formatNumber(weaponCost)} food`;
    this.weaponBtn.disabled = food < weaponCost || weapon >= MAX_EQUIPMENT_LEVEL;
    if (weapon >= MAX_EQUIPMENT_LEVEL) {
      this.weaponBtn.textContent = 'Max';
    } else {
      this.weaponBtn.textContent = 'Upgrade';
    }

    // Armor
    this.armorLevelDisplay.textContent = `Armor Lv.${armor}`;
    const armorCost = armor >= MAX_EQUIPMENT_LEVEL ? 0 : upgradeCost(10, 1.20, armor);
    this.armorCostDisplay.textContent = armor >= MAX_EQUIPMENT_LEVEL ? '' : ` ${formatNumber(armorCost)} food`;
    this.armorBtn.disabled = food < armorCost || armor >= MAX_EQUIPMENT_LEVEL;
    if (armor >= MAX_EQUIPMENT_LEVEL) {
      this.armorBtn.textContent = 'Max';
    } else {
      this.armorBtn.textContent = 'Upgrade';
    }

    // Stats
    this.strengthDisplay.textContent = formatNumber(getSoldierStrength(state));
    this.defenseDisplay.textContent = formatNumber(getSoldierDefense(state));
    this.speedDisplay.textContent = formatNumber(getSoldierSpeed(state));
    this.hpDisplay.textContent = formatNumber(getSoldierMaxHp(state));
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
