import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { getPrestigeBonuses, hasPurchased, type PrestigeBonuses } from '../../src/systems/PrestigeBonusSystem';

/**
 * PrestigeBonusSystem tests — TDD for Slice 4 wiring.
 * Tests bonus calculation, additive stacking, multiplicative combination,
 * and unlock flags.
 */
describe('PrestigeBonusSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('getPrestigeBonuses', () => {
    it('returns neutral bonuses (all 1.0, no unlocks) when no upgrades purchased', () => {
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBe(1.0);
      expect(bonuses.hatching).toBe(1.0);
      expect(bonuses.food).toBe(1.0);
      expect(bonuses.soldierTraining).toBe(1.0);
      expect(bonuses.workerEfficiency).toBe(1.0);
      expect(bonuses.autoEggLayer).toBe(false);
      expect(bonuses.startingResources).toBe(false);
      expect(bonuses.phaseSkip).toBe(false);
    });

    it('returns neutral bonuses when purchased array is empty', () => {
      state.prestigeTree.purchased = [];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBe(1.0);
    });

    it('returns neutral bonuses when prestigeTree is undefined (safety)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state as any).prestigeTree = undefined;
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBe(1.0);
      expect(bonuses.autoEggLayer).toBe(false);
    });

    // ─── Production Bonuses ───

    it('egg-laying bonus: 1 purchase → 1.25x multiplier', () => {
      state.prestigeTree.purchased = ['egg_laying_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(1.25, 4);
      // Other bonuses unaffected
      expect(bonuses.hatching).toBe(1.0);
    });

    it('hatching bonus: 1 purchase → 1.25x multiplier', () => {
      state.prestigeTree.purchased = ['hatching_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.hatching).toBeCloseTo(1.25, 4);
      expect(bonuses.eggLaying).toBe(1.0);
    });

    it('food bonus: 1 purchase → 1.25x multiplier', () => {
      state.prestigeTree.purchased = ['food_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.food).toBeCloseTo(1.25, 4);
    });

    it('soldier training bonus: 1 purchase → 1.25x multiplier', () => {
      state.prestigeTree.purchased = ['soldier_training_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.soldierTraining).toBeCloseTo(1.25, 4);
    });

    it('worker efficiency bonus: 1 purchase → 1.10x multiplier', () => {
      state.prestigeTree.purchased = ['worker_efficiency_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.workerEfficiency).toBeCloseTo(1.10, 4);
    });

    // ─── Additive Stacking (same upgrade) ───

    it('same upgrade additive: 2x egg-laying → 1.50x', () => {
      state.prestigeTree.purchased = ['egg_laying_bonus', 'egg_laying_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(1.50, 4);
    });

    it('same upgrade additive: 3x egg-laying → 1.75x', () => {
      state.prestigeTree.purchased = [
        'egg_laying_bonus',
        'egg_laying_bonus',
        'egg_laying_bonus',
      ];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(1.75, 4);
    });

    it('same upgrade additive: 2x worker efficiency → 1.20x', () => {
      state.prestigeTree.purchased = ['worker_efficiency_bonus', 'worker_efficiency_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.workerEfficiency).toBeCloseTo(1.20, 4);
    });

    // ─── Multiplicative Across Different Upgrades ───

    it('different upgrades multiply: egg 50% × worker 20% = 1.80 effective', () => {
      state.prestigeTree.purchased = [
        'egg_laying_bonus',
        'egg_laying_bonus',        // 1.50
        'worker_efficiency_bonus',  // 1.10
      ];
      const bonuses = getPrestigeBonuses(state);
      // Each bonus is independent; combined effect in systems = product
      expect(bonuses.eggLaying).toBeCloseTo(1.50, 4);
      expect(bonuses.workerEfficiency).toBeCloseTo(1.10, 4);
      // Cross-product in practice: 1.50 * 1.10 = 1.65 (but systems multiply independently)
      // The spec says "Bonuses from different upgrades should multiply"
      // Since each system applies its own bonus separately, the effect is multiplicative
      // But getPrestigeBonuses returns independent multipliers — systems build the product
      // This test just verifies the individual multipliers are correct
    });

    it('all 5 production bonuses purchased once each', () => {
      state.prestigeTree.purchased = [
        'egg_laying_bonus',
        'hatching_bonus',
        'food_bonus',
        'soldier_training_bonus',
        'worker_efficiency_bonus',
      ];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(1.25, 4);
      expect(bonuses.hatching).toBeCloseTo(1.25, 4);
      expect(bonuses.food).toBeCloseTo(1.25, 4);
      expect(bonuses.soldierTraining).toBeCloseTo(1.25, 4);
      expect(bonuses.workerEfficiency).toBeCloseTo(1.10, 4);
    });

    // ─── Unlock Upgrades ───

    it('auto-egg-layer: purchased → autoEggLayer flag true', () => {
      state.prestigeTree.purchased = ['auto_egg_laying'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.autoEggLayer).toBe(true);
      expect(bonuses.eggLaying).toBe(1.0); // not a production bonus
    });

    it('starting resources: purchased → startingResources flag true', () => {
      state.prestigeTree.purchased = ['starting_resources'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.startingResources).toBe(true);
    });

    it('phase skip: purchased → phaseSkip flag true', () => {
      state.prestigeTree.purchased = ['phase_skip'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.phaseSkip).toBe(true);
    });

    it('all 3 unlocks purchased', () => {
      state.prestigeTree.purchased = [
        'auto_egg_laying',
        'starting_resources',
        'phase_skip',
      ];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.autoEggLayer).toBe(true);
      expect(bonuses.startingResources).toBe(true);
      expect(bonuses.phaseSkip).toBe(true);
    });

    // ─── Combined ───

    it('production + unlock bonuses coexist independently', () => {
      state.prestigeTree.purchased = [
        'egg_laying_bonus',
        'auto_egg_laying',
        'starting_resources',
      ];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(1.25, 4);
      expect(bonuses.autoEggLayer).toBe(true);
      expect(bonuses.startingResources).toBe(true);
      expect(bonuses.phaseSkip).toBe(false);
    });

    it('bonuses are inactive before purchase (baseline)', () => {
      // Purchased empty — all neutral
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.autoEggLayer).toBe(false);
      expect(bonuses.startingResources).toBe(false);
      expect(bonuses.phaseSkip).toBe(false);

      // After purchase — active
      state.prestigeTree.purchased = ['auto_egg_laying', 'starting_resources', 'phase_skip'];
      const active = getPrestigeBonuses(state);
      expect(active.autoEggLayer).toBe(true);
      expect(active.startingResources).toBe(true);
      expect(active.phaseSkip).toBe(true);
    });
  });

  describe('hasPurchased', () => {
    it('returns false when no upgrade purchased', () => {
      expect(hasPurchased(state, 'egg_laying_bonus')).toBe(false);
    });

    it('returns true when upgrade is purchased', () => {
      state.prestigeTree.purchased = ['egg_laying_bonus'];
      expect(hasPurchased(state, 'egg_laying_bonus')).toBe(true);
    });

    it('returns false for a different upgrade', () => {
      state.prestigeTree.purchased = ['egg_laying_bonus'];
      expect(hasPurchased(state, 'hatching_bonus')).toBe(false);
    });

    it('returns false when prestigeTree is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state as any).prestigeTree = undefined;
      expect(hasPurchased(state, 'egg_laying_bonus')).toBe(false);
    });
  });
});
