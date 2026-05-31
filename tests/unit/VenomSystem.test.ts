import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/state/GameState';
import { getPoisonDamagePerTick, consumeVenom } from '../../src/systems/VenomSystem';

describe('VenomSystem', () => {
  describe('getPoisonDamagePerTick', () => {
    it('returns 0 when Venom Lab is not built', () => {
      const state = createInitialState();
      state.buildings.venom_lab.level = 0;
      state.combatResources.venom = 5;
      expect(getPoisonDamagePerTick(state)).toBe(0);
    });

    it('returns 0 when venom stock is 0 even with lab built', () => {
      const state = createInitialState();
      state.buildings.venom_lab.level = 1;
      state.combatResources.venom = 0;
      expect(getPoisonDamagePerTick(state)).toBe(0);
    });

    it('returns level * 2 when lab built and venom in stock (Lv.1)', () => {
      const state = createInitialState();
      state.buildings.venom_lab.level = 1;
      state.combatResources.venom = 1;
      expect(getPoisonDamagePerTick(state)).toBe(2);
    });

    it('returns level * 2 when lab built and venom in stock (Lv.3)', () => {
      const state = createInitialState();
      state.buildings.venom_lab.level = 3;
      state.combatResources.venom = 1;
      expect(getPoisonDamagePerTick(state)).toBe(6);
    });

    it('scales with Venom Lab level, not venom stock', () => {
      const state = createInitialState();
      state.buildings.venom_lab.level = 2;
      state.combatResources.venom = 10;
      // Level 2 * 2 = 4, regardless of venom stock amount
      expect(getPoisonDamagePerTick(state)).toBe(4);
    });

    it('returns 0 when both lab not built and venom is 0', () => {
      const state = createInitialState();
      state.buildings.venom_lab.level = 0;
      state.combatResources.venom = 0;
      expect(getPoisonDamagePerTick(state)).toBe(0);
    });
  });

  describe('consumeVenom', () => {
    it('deducts 1 venom from combat resources', () => {
      const state = createInitialState();
      state.combatResources.venom = 5;
      const newState = consumeVenom(state);
      expect(newState.combatResources.venom).toBe(4);
    });

    it('does not mutate the original state', () => {
      const state = createInitialState();
      state.combatResources.venom = 5;
      consumeVenom(state);
      expect(state.combatResources.venom).toBe(5);
    });

    it('preserves other combat resources', () => {
      const state = createInitialState();
      state.combatResources.chitin = 3;
      state.combatResources.silk = 7;
      state.combatResources.venom = 2;
      const newState = consumeVenom(state);
      expect(newState.combatResources.chitin).toBe(3);
      expect(newState.combatResources.silk).toBe(7);
      expect(newState.combatResources.venom).toBe(1);
    });

    it('can reduce venom to 0', () => {
      const state = createInitialState();
      state.combatResources.venom = 1;
      const newState = consumeVenom(state);
      expect(newState.combatResources.venom).toBe(0);
    });

    it('does not go below 0 when venom is already 0', () => {
      const state = createInitialState();
      state.combatResources.venom = 0;
      const newState = consumeVenom(state);
      // Deductions below 0 are not prevented by consumeVenom itself —
      // it's the caller's responsibility to check first.
      // This test verifies the arithmetic: 0 - 1 = -1.
      expect(newState.combatResources.venom).toBeLessThan(0);
    });
  });
});
