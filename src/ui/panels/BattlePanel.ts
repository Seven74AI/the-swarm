import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import type { SoldierSystem, getSoldierStrength, getSoldierDefense, getSoldierSpeed, getSoldierMaxHp } from '../../systems/SoldierSystem';
import type { BattleSystem, BattleResult } from '../../systems/BattleSystem';
import { getRandomEnemy, scaleEnemy, type EnemyDef } from '../../systems/EnemySystem';
import { formatNumber } from '../../utils/format';

/**
 * BattlePanel — main combat interface visible in COMBAT phase.
 * Flow: Scout Enemy → see preview → Engage → resolve → show result → repeat.
 */
export class BattlePanel {
  private container: HTMLDivElement;
  private scoutBtn: HTMLButtonElement;
  private engageBtn: HTMLButtonElement;
  private continueBtn: HTMLButtonElement;
  private scoutArea: HTMLDivElement;
  private resultArea: HTMLDivElement;
  private enemyNameDisplay: HTMLSpanElement;
  private comparisonDisplay: HTMLSpanElement;
  private soldierCountDisplay: HTMLSpanElement;
  private soldierStrengthDisplay: HTMLSpanElement;
  private soldierDefenseDisplay: HTMLSpanElement;
  private soldierSpeedDisplay: HTMLSpanElement;
  private soldierHpDisplay: HTMLSpanElement;
  private battlesWonDisplay: HTMLSpanElement;
  private battlesLostDisplay: HTMLSpanElement;
  private chitinDisplay: HTMLSpanElement;
  private silkDisplay: HTMLSpanElement;
  private venomDisplay: HTMLSpanElement;
  private combatResourcesArea: HTMLDivElement;
  private resultTitle: HTMLDivElement;
  private resultEnemy: HTMLDivElement;
  private resultSoldiersLost: HTMLDivElement;
  private resultFood: HTMLDivElement;
  private resultLoot: HTMLDivElement;
  private resultNarrative: HTMLDivElement;

  private scoutedEnemy: EnemyDef | null = null;
  private battleResult: BattleResult | null = null;

  constructor(
    private bus: EventBus,
    private soldierSystem: SoldierSystem,
    private battleSystem: BattleSystem,
    private getState: () => GameState,
    private setState: (s: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'battle-panel';
    this.container.className = 'panel battle-panel';
    this.container.style.display = 'none'; // Hidden until combat phase

    // Title
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '⚔️ The War';
    this.container.appendChild(title);

    // --- Your Forces ---
    const forcesSection = document.createElement('div');
    forcesSection.className = 'panel-subtitle';
    forcesSection.textContent = 'Your Forces';
    this.container.appendChild(forcesSection);

    // Soldiers row
    const soldiersRow = document.createElement('div');
    soldiersRow.className = 'stat-row';
    const soldiersLabel = document.createElement('span');
    soldiersLabel.className = 'stat-label';
    soldiersLabel.textContent = 'Soldiers: ';
    this.soldierCountDisplay = document.createElement('span');
    this.soldierCountDisplay.className = 'stat-value';
    soldiersRow.appendChild(soldiersLabel);
    soldiersRow.appendChild(this.soldierCountDisplay);
    this.container.appendChild(soldiersRow);

    // Stats row (Str, Def, Spd, HP)
    const statsRow = document.createElement('div');
    statsRow.className = 'stat-row';
    this.soldierStrengthDisplay = this.makeStatSpan();
    this.soldierDefenseDisplay = this.makeStatSpan();
    this.soldierSpeedDisplay = this.makeStatSpan();
    this.soldierHpDisplay = this.makeStatSpan();
    statsRow.appendChild(this.soldierStrengthDisplay);
    statsRow.appendChild(this.soldierDefenseDisplay);
    statsRow.appendChild(this.soldierSpeedDisplay);
    statsRow.appendChild(this.soldierHpDisplay);
    this.container.appendChild(statsRow);

    // Battles row
    const battlesRow = document.createElement('div');
    battlesRow.className = 'stat-row';
    const wonLabel = document.createElement('span');
    wonLabel.className = 'stat-label';
    wonLabel.textContent = 'Won: ';
    this.battlesWonDisplay = document.createElement('span');
    this.battlesWonDisplay.className = 'stat-value';
    battlesRow.appendChild(wonLabel);
    battlesRow.appendChild(this.battlesWonDisplay);
    const lostLabel = document.createElement('span');
    lostLabel.className = 'stat-label';
    lostLabel.textContent = ' Lost: ';
    this.battlesLostDisplay = document.createElement('span');
    this.battlesLostDisplay.className = 'stat-value';
    battlesRow.appendChild(lostLabel);
    battlesRow.appendChild(this.battlesLostDisplay);
    this.container.appendChild(battlesRow);

    // --- Combat Resources ---
    this.combatResourcesArea = document.createElement('div');
    this.combatResourcesArea.className = 'combat-resources';
    this.combatResourcesArea.style.display = 'none';
    this.chitinDisplay = document.createElement('span');
    this.silkDisplay = document.createElement('span');
    this.venomDisplay = document.createElement('span');
    this.combatResourcesArea.appendChild(this.chitinDisplay);
    this.combatResourcesArea.appendChild(this.silkDisplay);
    this.combatResourcesArea.appendChild(this.venomDisplay);
    this.container.appendChild(this.combatResourcesArea);

    // --- Enemy Scouted ---
    const scoutSection = document.createElement('div');
    scoutSection.className = 'panel-subtitle';
    scoutSection.textContent = 'Enemy Scouted';
    this.container.appendChild(scoutSection);

    this.scoutArea = document.createElement('div');
    this.scoutArea.className = 'scout-area';
    this.scoutArea.style.display = 'none';

    this.enemyNameDisplay = document.createElement('span');
    this.enemyNameDisplay.id = 'enemy-name';
    this.enemyNameDisplay.className = 'stat-value';
    this.scoutArea.appendChild(this.enemyNameDisplay);

    this.comparisonDisplay = document.createElement('span');
    this.comparisonDisplay.id = 'enemy-comparison';
    this.comparisonDisplay.className = 'stat-sub';
    this.scoutArea.appendChild(this.comparisonDisplay);
    this.container.appendChild(this.scoutArea);

    // Scout button
    this.scoutBtn = document.createElement('button');
    this.scoutBtn.id = 'scout-enemy';
    this.scoutBtn.className = 'btn btn-primary';
    this.scoutBtn.textContent = 'Scout Enemy';
    this.scoutBtn.addEventListener('click', () => this.onScout());
    this.container.appendChild(this.scoutBtn);

    // Engage button
    this.engageBtn = document.createElement('button');
    this.engageBtn.id = 'engage-battle';
    this.engageBtn.className = 'btn btn-danger';
    this.engageBtn.textContent = '⚔️ Engage!';
    this.engageBtn.disabled = true;
    this.engageBtn.addEventListener('click', () => this.onEngage());
    this.container.appendChild(this.engageBtn);

    // --- Battle Result ---
    this.resultArea = document.createElement('div');
    this.resultArea.id = 'battle-result';
    this.resultArea.className = 'battle-result';
    this.resultArea.style.display = 'none';

    this.resultTitle = document.createElement('div');
    this.resultTitle.className = 'result-title';
    this.resultArea.appendChild(this.resultTitle);

    this.resultEnemy = document.createElement('div');
    this.resultArea.appendChild(this.resultEnemy);

    this.resultSoldiersLost = document.createElement('div');
    this.resultArea.appendChild(this.resultSoldiersLost);

    this.resultFood = document.createElement('div');
    this.resultArea.appendChild(this.resultFood);

    this.resultLoot = document.createElement('div');
    this.resultArea.appendChild(this.resultLoot);

    this.resultNarrative = document.createElement('div');
    this.resultNarrative.className = 'result-narrative';
    this.resultArea.appendChild(this.resultNarrative);

    this.continueBtn = document.createElement('button');
    this.continueBtn.id = 'battle-continue';
    this.continueBtn.className = 'btn btn-primary';
    this.continueBtn.textContent = 'Continue';
    this.continueBtn.addEventListener('click', () => this.onContinue());
    this.resultArea.appendChild(this.continueBtn);

    this.container.appendChild(this.resultArea);

    // Reactive: auto-refresh when battle state changes
    effect(() => {
      const s = gameState.value;
      void s.combatSoldiers;
      void s.equipment;
      void s.battlesWon;
      void s.battlesLost;
      void s.combatResources;
      void s.soldierStats;
      this.refresh();
    });

    // Initial render
    this.refresh();
  }

  private makeStatSpan(): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'stat-value';
    return span;
  }

  private refresh(): void {
    const state = this.getState();

    this.soldierCountDisplay.textContent = formatNumber(state.combatSoldiers);

    // Use the same stat functions as SoldierPanel / BattleSystem
    const strength = 1 + state.equipment.weapon;
    const defense = 1 + state.equipment.armor;
    const speed = 5;
    const maxHp = 10 + state.equipment.armor * 2;

    this.soldierStrengthDisplay.textContent = `Str:${formatNumber(strength)}`;
    this.soldierDefenseDisplay.textContent = `Def:${formatNumber(defense)}`;
    this.soldierSpeedDisplay.textContent = `Spd:${formatNumber(speed)}`;
    this.soldierHpDisplay.textContent = `HP:${formatNumber(maxHp)}`;

    this.battlesWonDisplay.textContent = formatNumber(state.battlesWon);
    this.battlesLostDisplay.textContent = formatNumber(state.battlesLost);

    // Combat resources
    const cr = state.combatResources;
    const hasResources = cr.chitin > 0 || cr.silk > 0 || cr.venom > 0;
    this.combatResourcesArea.style.display = hasResources ? '' : 'none';
    if (hasResources) {
      this.chitinDisplay.textContent = cr.chitin > 0 ? `Chitin: ${formatNumber(cr.chitin)}` : '';
      this.silkDisplay.textContent = cr.silk > 0 ? `Silk: ${formatNumber(cr.silk)}` : '';
      this.venomDisplay.textContent = cr.venom > 0 ? `Venom: ${formatNumber(cr.venom)}` : '';
    }

    // Button states
    this.scoutBtn.disabled = state.combatSoldiers <= 0;
    if (this.scoutBtn.disabled) {
      this.scoutBtn.setAttribute('data-tooltip', 'Requires combat soldiers');
    } else {
      this.scoutBtn.removeAttribute('data-tooltip');
    }
    this.engageBtn.disabled = !this.scoutedEnemy || state.combatSoldiers <= 0;
    if (this.engageBtn.disabled) {
      if (!this.scoutedEnemy && state.combatSoldiers <= 0) {
        this.engageBtn.setAttribute('data-tooltip', 'Scout an enemy first (requires combat soldiers)');
      } else if (!this.scoutedEnemy) {
        this.engageBtn.setAttribute('data-tooltip', 'Scout an enemy first');
      } else {
        this.engageBtn.setAttribute('data-tooltip', 'Requires combat soldiers');
      }
    } else {
      this.engageBtn.removeAttribute('data-tooltip');
    }
  }

  private onScout(): void {
    const state = this.getState();
    if (state.combatSoldiers <= 0) return;

    const baseEnemy = getRandomEnemy(state.battlesWon);
    this.scoutedEnemy = scaleEnemy(baseEnemy, state.battlesWon);

    this.enemyNameDisplay.textContent = `A ${this.scoutedEnemy.name} approaches.`;
    this.scoutArea.style.display = '';

    // Power comparison
    const playerPower = state.combatSoldiers * (1 + state.equipment.weapon);
    const enemyPower = this.scoutedEnemy.strength * (this.scoutedEnemy.hp / 10);
    const ratio = playerPower / Math.max(enemyPower, 0.1);

    let comparison: string;
    if (ratio > 1.5) {
      comparison = 'We outmatch them.';
    } else if (ratio >= 0.8) {
      comparison = 'An even fight.';
    } else {
      comparison = 'They look dangerous.';
    }
    this.comparisonDisplay.textContent = ` ${comparison}`;

    this.engageBtn.disabled = false;

    this.bus.emit('enemy_scouted', { enemyType: this.scoutedEnemy.type, enemyName: this.scoutedEnemy.name });
  }

  private onEngage(): void {
    const state = this.getState();
    if (!this.scoutedEnemy || state.combatSoldiers <= 0) return;

    this.bus.emit('battle_engage', { enemyType: this.scoutedEnemy.type });

    const { result, newState } = this.battleSystem.resolveBattle(state);
    this.battleResult = result;
    this.setState(newState);

    this.showResult();
  }

  private showResult(): void {
    if (!this.battleResult) return;

    this.resultTitle.textContent = this.battleResult.victory ? '🏆 Victory!' : '💀 Defeat';
    this.resultEnemy.textContent = `Enemy: ${this.battleResult.enemyType}`;
    this.resultSoldiersLost.textContent = `Soldiers Lost: ${formatNumber(this.battleResult.soldiersLost)}`;
    this.resultFood.textContent = `Food Gained: +${formatNumber(this.battleResult.foodGained)}`;

    const parts: string[] = [];
    if (this.battleResult.specialLoot.chitin > 0) parts.push(`${this.battleResult.specialLoot.chitin} Chitin`);
    if (this.battleResult.specialLoot.silk > 0) parts.push(`${this.battleResult.specialLoot.silk} Silk`);
    if (this.battleResult.specialLoot.venom > 0) parts.push(`${this.battleResult.specialLoot.venom} Venom`);
    this.resultLoot.textContent = parts.length > 0 ? `Special Loot: ${parts.join(', ')}` : '';

    this.resultNarrative.textContent = this.battleResult.narrative;

    this.resultArea.style.display = '';
  }

  private onContinue(): void {
    this.scoutedEnemy = null;
    this.battleResult = null;
    this.scoutArea.style.display = 'none';
    this.resultArea.style.display = 'none';
    this.engageBtn.disabled = true;
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
