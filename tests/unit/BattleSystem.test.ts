import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { BattleSystem } from '../../src/systems/BattleSystem';

describe('BattleSystem', () => {
  let bus: EventBus;
  let system: BattleSystem;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    system = new BattleSystem(bus);
    state = createInitialState();
  });

  function setupStrongArmy(soldiers: number): void {
    state.combatSoldiers = soldiers;
    state.equipment.weapon = 5;   // max strength boost
    state.equipment.armor = 5;    // max defense/hp boost
  }

  function setupWeakArmy(soldiers: number): void {
    state.combatSoldiers = soldiers;
    state.equipment.weapon = 0;
    state.equipment.armor = 0;
  }

  describe('resolveBattle', () => {
    it('returns victory with strong army vs Red Ant', () => {
      setupStrongArmy(100);
      const { result, newState } = system.resolveBattle(state);
      expect(result.victory).toBe(true);
      expect(result.enemyType).toBeDefined();
      expect(result.narrative).toBeTruthy();
      expect(newState.battlesWon).toBe(state.battlesWon + 1);
    });

    it('returns defeat with 1 weak soldier vs scorpion (after 5+ battles to unlock boss)', () => {
      setupWeakArmy(1);
      state.battlesWon = 10; // unlock scorpion
      // Force scorpion by mocking random to hit the scorpion bucket (indices 97-99 of 100)
      vi.spyOn(Math, 'random').mockReturnValue(0.98);
      const { result, newState } = system.resolveBattle(state);
      expect(result.enemyType).toBe('scorpion');
      expect(result.victory).toBe(false);
      expect(newState.battlesLost).toBe(state.battlesLost + 1);
    });

    it('soldiers lost never exceeds soldier count', () => {
      setupWeakArmy(3);
      for (let i = 0; i < 20; i++) {
        const testState = { ...state, combatSoldiers: 3 };
        const { result } = system.resolveBattle(testState);
        expect(result.soldiersLost).toBeGreaterThanOrEqual(0);
        expect(result.soldiersLost).toBeLessThanOrEqual(3);
      }
    });

    it('soldiers lost is never negative', () => {
      setupWeakArmy(10);
      for (let i = 0; i < 20; i++) {
        const testState = { ...state, combatSoldiers: 10 };
        const { result } = system.resolveBattle(testState);
        expect(result.soldiersLost).toBeGreaterThanOrEqual(0);
      }
    });

    it('BattleResult has correct structure on victory', () => {
      setupStrongArmy(100);
      const { result } = system.resolveBattle(state);
      expect(result).toHaveProperty('victory');
      expect(result).toHaveProperty('soldiersLost');
      expect(result).toHaveProperty('enemyType');
      expect(result).toHaveProperty('foodGained');
      expect(result).toHaveProperty('specialLoot');
      expect(result).toHaveProperty('narrative');
      expect(result.specialLoot).toHaveProperty('chitin');
      expect(result.specialLoot).toHaveProperty('silk');
      expect(result.specialLoot).toHaveProperty('venom');
      expect(typeof result.victory).toBe('boolean');
      expect(typeof result.soldiersLost).toBe('number');
      expect(typeof result.enemyType).toBe('string');
      expect(typeof result.foodGained).toBe('number');
      expect(typeof result.narrative).toBe('string');
    });

    it('BattleResult has correct structure on defeat', () => {
      setupWeakArmy(1);
      for (let i = 0; i < 50; i++) {
        const testState = { ...state, combatSoldiers: 1 };
        const { result } = system.resolveBattle(testState);
        if (!result.victory) {
          expect(result.foodGained).toBe(0);
          expect(result.specialLoot.chitin).toBe(0);
          expect(result.specialLoot.silk).toBe(0);
          expect(result.specialLoot.venom).toBe(0);
          break;
        }
      }
    });

    it('food gained on victory is within loot min-max range', () => {
      setupStrongArmy(100);
      for (let i = 0; i < 50; i++) {
        const testState = { ...state, combatSoldiers: 100 };
        testState.equipment.weapon = 5;
        testState.equipment.armor = 5;
        const { result } = system.resolveBattle(testState);
        if (result.victory && result.foodGained > 0) {
          // Red Ant loot: 5-10, Termite: 10-20, Spider: 25-40,
          // Beetle: 30-50, Wasp: 20-35, Scorpion: 60-100
          // Min of all: 5, Max of all: 100
          expect(result.foodGained).toBeGreaterThanOrEqual(5);
          expect(result.foodGained).toBeLessThanOrEqual(100);
        }
      }
    });

    it('special resources gained on victory are within range', () => {
      setupStrongArmy(100);
      for (let i = 0; i < 50; i++) {
        const testState = { ...state, combatSoldiers: 100 };
        testState.equipment.weapon = 5;
        testState.equipment.armor = 5;
        const { result } = system.resolveBattle(testState);
        if (result.victory) {
          // Silk: 0-3, Chitin: 0-5, Venom: 0-8 (max from scorpion)
          expect(result.specialLoot.silk).toBeGreaterThanOrEqual(0);
          expect(result.specialLoot.silk).toBeLessThanOrEqual(3);
          expect(result.specialLoot.chitin).toBeGreaterThanOrEqual(0);
          expect(result.specialLoot.chitin).toBeLessThanOrEqual(5);
          expect(result.specialLoot.venom).toBeGreaterThanOrEqual(0);
          expect(result.specialLoot.venom).toBeLessThanOrEqual(8);
        }
      }
    });

    it('lastBattle is populated after battle', () => {
      setupStrongArmy(100);
      const { newState } = system.resolveBattle(state);
      expect(newState.lastBattle).not.toBeNull();
      expect(newState.lastBattle!.enemyType).toBeTruthy();
      expect(['victory', 'defeat']).toContain(newState.lastBattle!.result);
      expect(newState.lastBattle!.soldiersLost).toBeGreaterThanOrEqual(0);
      expect(newState.lastBattle!.foodGained).toBeGreaterThanOrEqual(0);
      expect(newState.lastBattle!.timestamp).toBeGreaterThan(0);
    });

    it('battlesWon increments on victory', () => {
      setupStrongArmy(100);
      const initialWins = state.battlesWon;
      const { result, newState } = system.resolveBattle(state);
      if (result.victory) {
        expect(newState.battlesWon).toBe(initialWins + 1);
        expect(newState.battlesLost).toBe(state.battlesLost);
      }
    });

    it('battlesLost increments on defeat', () => {
      setupWeakArmy(1);
      // Need to fight enough to likely get a defeat
      for (let i = 0; i < 50; i++) {
        const testState = { ...state, combatSoldiers: 1 };
        const { result, newState } = system.resolveBattle(testState);
        if (!result.victory) {
          expect(newState.battlesLost).toBe(testState.battlesLost + 1);
          expect(newState.battlesWon).toBe(testState.battlesWon);
          break;
        }
      }
    });

    it('multiple battles reduce soldier count by losses', () => {
      setupWeakArmy(50);
      const { newState: state1 } = system.resolveBattle(state);
      // The number of soldiers should be reduced by soldiersLost
      expect(state1.combatSoldiers).toBeLessThanOrEqual(state.combatSoldiers);
      expect(state1.combatSoldiers).toBe(state.combatSoldiers - state1.lastBattle!.soldiersLost);
    });

    it('emits battle_completed event', () => {
      setupStrongArmy(100);
      let eventPayload: unknown = null;
      bus.subscribe('battle_completed', (payload: unknown) => {
        eventPayload = payload;
      });
      system.resolveBattle(state);
      expect(eventPayload).not.toBeNull();
    });

    it('handles 0 soldiers gracefully', () => {
      state.combatSoldiers = 0;
      const { result, newState } = system.resolveBattle(state);
      expect(newState).toBe(state); // unchanged
      expect(result.victory).toBe(false);
    });

    it('food resources are added to state on victory', () => {
      setupStrongArmy(100);
      const initialFood = state.resources.food;
      const { result, newState } = system.resolveBattle(state);
      if (result.victory) {
        expect(newState.resources.food).toBe(initialFood + result.foodGained);
      }
    });

    it('combatResources are added to state on victory with special loot', () => {
      setupStrongArmy(100);
      const { result, newState } = system.resolveBattle(state);
      if (result.victory) {
        expect(newState.combatResources.chitin).toBeGreaterThanOrEqual(state.combatResources.chitin);
        expect(newState.combatResources.silk).toBeGreaterThanOrEqual(state.combatResources.silk);
        expect(newState.combatResources.venom).toBeGreaterThanOrEqual(state.combatResources.venom);
      }
    });
  });
});
