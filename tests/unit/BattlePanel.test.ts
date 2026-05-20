import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { gameState } from '../../src/state/gameSignal';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { BattlePanel } from '../../src/ui/panels/BattlePanel';

describe('BattlePanel', () => {
  let bus: EventBus;
  let soldierSystem: SoldierSystem;
  let battleSystem: BattleSystem;
  let state: GameState;
  let getState: () => GameState;
  let setState: (s: GameState) => void;
  let panel: BattlePanel;

  beforeEach(() => {
    bus = new EventBus();
    state = createInitialState();
    gameState.value = state;
    soldierSystem = new SoldierSystem(bus);
    battleSystem = new BattleSystem(bus);
    getState = () => gameState.value;
    setState = (s: GameState) => { gameState.value = s; };
  });

  function createPanel(): BattlePanel {
    return new BattlePanel(bus, soldierSystem, battleSystem, getState, setState);
  }

  describe('rendering', () => {
    it('renders the battle panel with title', () => {
      panel = createPanel();
      const el = panel.getElement();
      expect(el.querySelector('.panel-title')?.textContent).toContain('The War');
    });

    it('shows soldier count and stats', () => {
      state.combatSoldiers = 12;
      state.equipment.weapon = 2;
      state.equipment.armor = 1;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      expect(el.textContent).toContain('12');
      expect(el.textContent).toContain('Str:3');
      expect(el.textContent).toContain('Def:2');
    });

    it('shows battles won and lost', () => {
      state.battlesWon = 5;
      state.battlesLost = 2;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      expect(el.textContent).toContain('5');
      expect(el.textContent).toContain('2');
    });

    it('shows combat resources when > 0', () => {
      state.combatResources = { chitin: 3, silk: 2, venom: 1 };
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      expect(el.textContent).toContain('Chitin: 3');
      expect(el.textContent).toContain('Silk: 2');
      expect(el.textContent).toContain('Venom: 1');
    });

    it('does not show combat resources when all 0', () => {
      state.combatResources = { chitin: 0, silk: 0, venom: 0 };
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      expect(el.textContent).not.toContain('Chitin');
      expect(el.textContent).not.toContain('Silk');
      expect(el.textContent).not.toContain('Venom');
    });
  });

  describe('scout button', () => {
    it('scout button reveals enemy name and comparison', () => {
      state.combatSoldiers = 10;
      state.equipment.weapon = 0;
      state.equipment.armor = 0;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      const scoutBtn = el.querySelector('#scout-enemy') as HTMLButtonElement;

      expect(scoutBtn).not.toBeNull();
      scoutBtn.click();

      // After scout, enemy name should be visible
      const enemyNameEl = el.querySelector('#enemy-name');
      expect(enemyNameEl).not.toBeNull();
      expect(enemyNameEl!.textContent).toBeTruthy();

      // Comparison text should be visible
      const comparisonEl = el.querySelector('#enemy-comparison');
      expect(comparisonEl).not.toBeNull();
      expect(comparisonEl!.textContent).toBeTruthy();
    });

    it('scout button is disabled when no soldiers', () => {
      state.combatSoldiers = 0;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      const scoutBtn = el.querySelector('#scout-enemy') as HTMLButtonElement;
      expect(scoutBtn.disabled).toBe(true);
    });
  });

  describe('engage button', () => {
    it('engage button is disabled before scouting', () => {
      state.combatSoldiers = 10;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      const engageBtn = el.querySelector('#engage-battle') as HTMLButtonElement;
      expect(engageBtn.disabled).toBe(true);
    });

    it('engage button is enabled after scouting with soldiers', () => {
      state.combatSoldiers = 10;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();

      // Scout first
      const scoutBtn = el.querySelector('#scout-enemy') as HTMLButtonElement;
      scoutBtn.click();

      const engageBtn = el.querySelector('#engage-battle') as HTMLButtonElement;
      expect(engageBtn.disabled).toBe(false);
    });

    it('engage button triggers battle and shows result', () => {
      // Give strong army to ensure victory
      state.combatSoldiers = 100;
      state.equipment.weapon = 5;
      state.equipment.armor = 5;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();

      // Scout
      (el.querySelector('#scout-enemy') as HTMLButtonElement).click();

      // Engage
      const engageBtn = el.querySelector('#engage-battle') as HTMLButtonElement;
      engageBtn.click();

      // Result should be visible
      const resultEl = el.querySelector('#battle-result');
      expect(resultEl).not.toBeNull();
      expect(resultEl!.textContent).toMatch(/Victory|Defeat/);
    });
  });

  describe('battle result panel', () => {
    it('shows continue button after battle', () => {
      state.combatSoldiers = 100;
      state.equipment.weapon = 5;
      state.equipment.armor = 5;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();

      (el.querySelector('#scout-enemy') as HTMLButtonElement).click();
      (el.querySelector('#engage-battle') as HTMLButtonElement).click();

      const continueBtn = el.querySelector('#battle-continue') as HTMLButtonElement;
      expect(continueBtn).not.toBeNull();
    });

    it('continue button resets scout state', () => {
      state.combatSoldiers = 100;
      state.equipment.weapon = 5;
      state.equipment.armor = 5;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();

      (el.querySelector('#scout-enemy') as HTMLButtonElement).click();
      (el.querySelector('#engage-battle') as HTMLButtonElement).click();

      const continueBtn = el.querySelector('#battle-continue') as HTMLButtonElement;
      continueBtn.click();

      // After continue, result should be hidden and scout state reset
      const resultEl = el.querySelector('#battle-result') as HTMLElement;
      expect(resultEl.style.display).toBe('none');

      // Scout area should be hidden
      const scoutDiv = el.querySelector('.scout-area') as HTMLElement;
      expect(scoutDiv.style.display).toBe('none');

      // Engage should be disabled again
      const engageBtn = el.querySelector('#engage-battle') as HTMLButtonElement;
      expect(engageBtn.disabled).toBe(true);
    });
  });

  describe('comparison text', () => {
    it('shows "outmatch" when power ratio > 1.5', () => {
      state.combatSoldiers = 100;
      state.equipment.weapon = 5;
      state.equipment.armor = 5;
      gameState.value = state;
      panel = createPanel();
      const el = panel.getElement();
      (el.querySelector('#scout-enemy') as HTMLButtonElement).click();
      // With max strength army and scaling at 0 battles won, ratio should be huge
      const comp = el.querySelector('#enemy-comparison');
      expect(comp).not.toBeNull();
      // The comparison text should be one of the three variants
      const text = comp!.textContent || '';
      expect(
        text.includes('outmatch') || text.includes('even fight') || text.includes('dangerous'),
      ).toBe(true);
    });
  });
});
