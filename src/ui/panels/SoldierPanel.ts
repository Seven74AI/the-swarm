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
import { formatNumber, formatRate } from '../../utils/format';

/** Track previous display values to avoid redundant DOM writes. */
interface SoldierDisplayState {
  workers: string;
  soldiers: string;
  training: string;
  recruitDisabled: boolean;
  weaponLevel: string;
  weaponCost: string;
  weaponDisabled: boolean;
  weaponBtnText: string;
  armorLevel: string;
  armorCost: string;
  armorDisabled: boolean;
  armorBtnText: string;
  strength: string;
  defense: string;
  speed: string;
  hp: string;
}

const EMPTY_SOLDIER_DISPLAY: SoldierDisplayState = {
  workers: '',
  soldiers: '',
  training: '',
  recruitDisabled: false,
  weaponLevel: '',
  weaponCost: '',
  weaponDisabled: false,
  weaponBtnText: '',
  armorLevel: '',
  armorCost: '',
  armorDisabled: false,
  armorBtnText: '',
  strength: '',
  defense: '',
  speed: '',
  hp: '',
};

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
  private lastDisplay: SoldierDisplayState = { ...EMPTY_SOLDIER_DISPLAY };

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
      const updated = this.soldierSystem.recruitSoldier(state);
      if (updated !== state) {
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
    const prev = this.lastDisplay;

    // Workers — dirty-check formatted string
    const workersText = formatNumber(availableWorkers);
    if (workersText !== prev.workers) {
      this.workersDisplay.textContent = workersText;
      prev.workers = workersText;
    }

    // Soldiers — dirty-check formatted string
    const soldiersText = formatNumber(state.combatSoldiers);
    if (soldiersText !== prev.soldiers) {
      this.soldiersDisplay.textContent = soldiersText;
      prev.soldiers = soldiersText;
    }

    // Training — dirty-check display text
    const trainingText = trainCount > 0
      ? ` [${formatNumber(trainCount)} training · ${formatRate(trainCount / SOLDIER_TRAIN_TIME)}/s]`
      : '';
    if (trainingText !== prev.training) {
      this.trainingDisplay.textContent = trainingText;
      prev.training = trainingText;
    }

    // Recruit button
    const recruitDisabled = availableWorkers < 1 || food < SOLDIER_COST_FOOD;
    if (recruitDisabled !== prev.recruitDisabled) {
      this.recruitBtn.disabled = recruitDisabled;
      prev.recruitDisabled = recruitDisabled;
    }

    // Weapon level
    const weaponLevelText = `Weapons Lv.${weapon}`;
    if (weaponLevelText !== prev.weaponLevel) {
      this.weaponLevelDisplay.textContent = weaponLevelText;
      prev.weaponLevel = weaponLevelText;
    }

    // Weapon cost
    const weaponCost = weapon >= MAX_EQUIPMENT_LEVEL ? 0 : upgradeCost(10, 1.20, weapon);
    const weaponCostText = weapon >= MAX_EQUIPMENT_LEVEL ? '' : ` ${formatNumber(weaponCost)} food`;
    if (weaponCostText !== prev.weaponCost) {
      this.weaponCostDisplay.textContent = weaponCostText;
      prev.weaponCost = weaponCostText;
    }

    // Weapon button state
    const weaponDisabled = food < weaponCost || weapon >= MAX_EQUIPMENT_LEVEL;
    if (weaponDisabled !== prev.weaponDisabled) {
      this.weaponBtn.disabled = weaponDisabled;
      prev.weaponDisabled = weaponDisabled;
    }

    const weaponBtnText = weapon >= MAX_EQUIPMENT_LEVEL ? 'Max' : 'Upgrade';
    if (weaponBtnText !== prev.weaponBtnText) {
      this.weaponBtn.textContent = weaponBtnText;
      prev.weaponBtnText = weaponBtnText;
    }

    // Armor level
    const armorLevelText = `Armor Lv.${armor}`;
    if (armorLevelText !== prev.armorLevel) {
      this.armorLevelDisplay.textContent = armorLevelText;
      prev.armorLevel = armorLevelText;
    }

    // Armor cost
    const armorCost = armor >= MAX_EQUIPMENT_LEVEL ? 0 : upgradeCost(10, 1.20, armor);
    const armorCostText = armor >= MAX_EQUIPMENT_LEVEL ? '' : ` ${formatNumber(armorCost)} food`;
    if (armorCostText !== prev.armorCost) {
      this.armorCostDisplay.textContent = armorCostText;
      prev.armorCost = armorCostText;
    }

    // Armor button state
    const armorDisabled = food < armorCost || armor >= MAX_EQUIPMENT_LEVEL;
    if (armorDisabled !== prev.armorDisabled) {
      this.armorBtn.disabled = armorDisabled;
      prev.armorDisabled = armorDisabled;
    }

    const armorBtnText = armor >= MAX_EQUIPMENT_LEVEL ? 'Max' : 'Upgrade';
    if (armorBtnText !== prev.armorBtnText) {
      this.armorBtn.textContent = armorBtnText;
      prev.armorBtnText = armorBtnText;
    }

    // Stats
    const strengthText = formatNumber(getSoldierStrength(state));
    if (strengthText !== prev.strength) {
      this.strengthDisplay.textContent = strengthText;
      prev.strength = strengthText;
    }

    const defenseText = formatNumber(getSoldierDefense(state));
    if (defenseText !== prev.defense) {
      this.defenseDisplay.textContent = defenseText;
      prev.defense = defenseText;
    }

    const speedText = formatNumber(getSoldierSpeed(state));
    if (speedText !== prev.speed) {
      this.speedDisplay.textContent = speedText;
      prev.speed = speedText;
    }

    const hpText = formatNumber(getSoldierMaxHp(state));
    if (hpText !== prev.hp) {
      this.hpDisplay.textContent = hpText;
      prev.hp = hpText;
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
