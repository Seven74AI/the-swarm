import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  purchaseMutation,
  canPurchaseMutation,
  getMutationEffects,
  isMutationUnlocked,
  getMutationCost,
  getMutationDef,
  MUTATIONS,
  type MutationEffects,
} from '../../src/systems/MutationSystem';

describe('MutationSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  function giveResources(cr: { chitin?: number; silk?: number; venom?: number }): void {
    state.combatResources.chitin = cr.chitin ?? 0;
    state.combatResources.silk = cr.silk ?? 0;
    state.combatResources.venom = cr.venom ?? 0;
  }

  describe('MUTATIONS registry', () => {
    it('has exactly 6 mutations', () => {
      expect(MUTATIONS.length).toBe(6);
    });

    it('every mutation has a unique id', () => {
      const ids = MUTATIONS.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('efficient_gatherers has no prerequisite', () => {
      const def = getMutationDef('efficient_gatherers');
      expect(def?.prerequisite).toBeNull();
    });

    it('potent_venom requires accelerated_hatching', () => {
      const def = getMutationDef('potent_venom');
      expect(def?.prerequisite).toBe('accelerated_hatching');
    });

    it('reinforced_mandibles requires swift_soldiers', () => {
      const def = getMutationDef('reinforced_mandibles');
      expect(def?.prerequisite).toBe('swift_soldiers');
    });
  });

  describe('purchaseMutation', () => {
    it('deducts correct combat resources for efficient_gatherers', () => {
      giveResources({ chitin: 10, silk: 10 });
      const silkBefore = state.combatResources.silk;
      const chitinBefore = state.combatResources.chitin;
      const result = purchaseMutation(state, 'efficient_gatherers');
      expect(result).not.toBe(state);
      expect(result.combatResources.silk).toBeLessThan(silkBefore);
      expect(result.combatResources.chitin).toBeLessThan(chitinBefore);
      // Venom unchanged
      expect(result.combatResources.venom).toBe(state.combatResources.venom);
    });

    it('marks mutation as purchased', () => {
      giveResources({ chitin: 10, silk: 10 });
      const result = purchaseMutation(state, 'efficient_gatherers');
      const purchased = result.mutations.find((m) => m.id === 'efficient_gatherers');
      expect(purchased?.purchased).toBe(true);
    });

    it('returns same reference on double purchase', () => {
      giveResources({ chitin: 20, silk: 20 });
      const first = purchaseMutation(state, 'efficient_gatherers');
      const second = purchaseMutation(first, 'efficient_gatherers');
      expect(second).toBe(first);
    });

    it('returns same reference when insufficient resources', () => {
      giveResources({ chitin: 1, silk: 1 });
      const result = purchaseMutation(state, 'efficient_gatherers');
      expect(result).toBe(state);
    });

    it('returns same reference for nonexistent mutation id', () => {
      giveResources({ chitin: 100, silk: 100, venom: 100 });
      const result = purchaseMutation(state, 'nonexistent');
      expect(result).toBe(state);
    });

    it('blocks potent_venom when prerequisite (accelerated_hatching) not purchased', () => {
      giveResources({ chitin: 20, silk: 20, venom: 30 });
      const result = purchaseMutation(state, 'potent_venom');
      expect(result).toBe(state);
    });

    it('allows potent_venom after accelerated_hatching is purchased', () => {
      giveResources({ chitin: 30, silk: 20, venom: 30 });
      const afterAccel = purchaseMutation(state, 'accelerated_hatching');
      const afterVenom = purchaseMutation(afterAccel, 'potent_venom');
      expect(afterVenom).not.toBe(afterAccel);
      const venomMut = afterVenom.mutations.find((m) => m.id === 'potent_venom');
      expect(venomMut?.purchased).toBe(true);
    });

    it('reducing combat resources to negative values should not happen', () => {
      giveResources({ chitin: 10, silk: 10 });
      const result = purchaseMutation(state, 'efficient_gatherers');
      expect(result.combatResources.chitin).toBeGreaterThanOrEqual(0);
      expect(result.combatResources.silk).toBeGreaterThanOrEqual(0);
      expect(result.combatResources.venom).toBeGreaterThanOrEqual(0);
    });
  });

  describe('canPurchaseMutation', () => {
    it('returns true with sufficient resources and no prerequisite', () => {
      giveResources({ chitin: 10, silk: 10 });
      expect(canPurchaseMutation(state, 'efficient_gatherers')).toBe(true);
    });

    it('returns false with insufficient resources', () => {
      giveResources({ chitin: 1, silk: 1 });
      expect(canPurchaseMutation(state, 'efficient_gatherers')).toBe(false);
    });

    it('returns false when already purchased', () => {
      giveResources({ chitin: 20, silk: 20 });
      const purchased = purchaseMutation(state, 'efficient_gatherers');
      expect(canPurchaseMutation(purchased, 'efficient_gatherers')).toBe(false);
    });

    it('returns false when prerequisite not met', () => {
      giveResources({ chitin: 30, silk: 20, venom: 30 });
      expect(canPurchaseMutation(state, 'potent_venom')).toBe(false);
    });

    it('returns true when prerequisite is met', () => {
      giveResources({ chitin: 30, silk: 20, venom: 30 });
      const afterAccel = purchaseMutation(state, 'accelerated_hatching');
      expect(canPurchaseMutation(afterAccel, 'potent_venom')).toBe(true);
    });
  });

  describe('isMutationUnlocked', () => {
    it('returns true for mutations without prerequisites', () => {
      expect(isMutationUnlocked(state, 'efficient_gatherers')).toBe(true);
      expect(isMutationUnlocked(state, 'swift_soldiers')).toBe(true);
      expect(isMutationUnlocked(state, 'accelerated_hatching')).toBe(true);
      expect(isMutationUnlocked(state, 'tough_shells')).toBe(true);
    });

    it('returns false for potent_venom when prerequisite not purchased', () => {
      expect(isMutationUnlocked(state, 'potent_venom')).toBe(false);
    });

    it('returns true for potent_venom after prerequisite purchased', () => {
      giveResources({ chitin: 20, silk: 20, venom: 20 });
      const afterAccel = purchaseMutation(state, 'accelerated_hatching');
      expect(isMutationUnlocked(afterAccel, 'potent_venom')).toBe(true);
    });
  });

  describe('getMutationEffects', () => {
    it('returns zero effects when no mutations purchased', () => {
      const effects = getMutationEffects(state);
      expect(effects.gatherRate).toBe(0);
      expect(effects.speed).toBe(0);
      expect(effects.hatchRate).toBe(0);
      expect(effects.maxHp).toBe(0);
      expect(effects.poisonDamage).toBe(0);
      expect(effects.strength).toBe(0);
    });

    it('returns non-zero gather rate after purchasing efficient_gatherers', () => {
      giveResources({ chitin: 10, silk: 10 });
      const after = purchaseMutation(state, 'efficient_gatherers');
      const effects = getMutationEffects(after);
      expect(effects.gatherRate).toBeGreaterThan(0);
    });

    it('returns non-zero strength after purchasing reinforced_mandibles', () => {
      giveResources({ chitin: 40, silk: 20, venom: 10 });
      const afterSwift = purchaseMutation(state, 'swift_soldiers');
      const afterMandibles = purchaseMutation(afterSwift, 'reinforced_mandibles');
      const effects = getMutationEffects(afterMandibles);
      expect(effects.strength).toBeGreaterThan(0);
      expect(effects.speed).toBeGreaterThan(0); // swift_soldiers also purchased
    });

    it('aggregates effects from multiple purchased mutations', () => {
      giveResources({ chitin: 50, silk: 50, venom: 50 });
      let s = purchaseMutation(state, 'efficient_gatherers');
      s = purchaseMutation(s, 'swift_soldiers');
      s = purchaseMutation(s, 'tough_shells');
      const effects = getMutationEffects(s);
      expect(effects.gatherRate).toBeGreaterThan(0);
      expect(effects.speed).toBeGreaterThan(0);
      expect(effects.maxHp).toBeGreaterThan(0);
    });

    it('unpurchased mutations do not contribute to effects', () => {
      giveResources({ chitin: 10, silk: 10 });
      const after = purchaseMutation(state, 'efficient_gatherers');
      const effects = getMutationEffects(after);
      // Only efficient_gatherers is purchased, so only gatherRate should be non-zero
      expect(effects.gatherRate).toBeGreaterThan(0);
      expect(effects.speed).toBe(0);
      expect(effects.hatchRate).toBe(0);
    });
  });

  describe('getMutationCost', () => {
    it('returns non-zero cost for efficient_gatherers', () => {
      const cost = getMutationCost('efficient_gatherers');
      expect(cost.chitin).toBeGreaterThan(0);
      expect(cost.silk).toBeGreaterThan(0);
      expect(cost.venom).toBe(0);
    });

    it('returns zero cost for nonexistent mutation', () => {
      const cost = getMutationCost('nonexistent');
      expect(cost.chitin).toBe(0);
      expect(cost.silk).toBe(0);
      expect(cost.venom).toBe(0);
    });
  });

  describe('getMutationDef', () => {
    it('returns a definition with name for valid mutation', () => {
      const def = getMutationDef('efficient_gatherers');
      expect(def?.name).toBeTruthy();
      expect(def?.effects.gatherRate).toBeGreaterThan(0);
    });

    it('returns undefined for nonexistent mutation', () => {
      expect(getMutationDef('nonexistent')).toBeUndefined();
    });
  });

  describe('effect integration with stat functions', () => {
    it('getSoldierSpeed increases after swift_soldiers', async () => {
      const { getSoldierSpeed } = await import('../../src/systems/SoldierSystem');
      const before = getSoldierSpeed(state);
      giveResources({ chitin: 10, silk: 5, venom: 5 });
      const afterPurchase = purchaseMutation(state, 'swift_soldiers');
      const after = getSoldierSpeed(afterPurchase);
      expect(after).toBeGreaterThan(before);
    });

    it('getSoldierStrength increases after reinforced_mandibles', async () => {
      const { getSoldierStrength } = await import('../../src/systems/SoldierSystem');
      const before = getSoldierStrength(state);
      giveResources({ chitin: 40, silk: 20, venom: 10 });
      const afterSwift = purchaseMutation(state, 'swift_soldiers');
      const afterMandibles = purchaseMutation(afterSwift, 'reinforced_mandibles');
      const after = getSoldierStrength(afterMandibles);
      expect(after).toBeGreaterThan(before);
    });

    it('getSoldierMaxHp increases after tough_shells', async () => {
      const { getSoldierMaxHp } = await import('../../src/systems/SoldierSystem');
      const before = getSoldierMaxHp(state);
      giveResources({ chitin: 15, silk: 10 });
      const afterPurchase = purchaseMutation(state, 'tough_shells');
      const after = getSoldierMaxHp(afterPurchase);
      expect(after).toBeGreaterThan(before);
    });
  });
});
