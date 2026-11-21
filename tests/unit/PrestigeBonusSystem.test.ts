import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { getPrestigeBonuses, hasPurchased, type PrestigeBonuses } from '../../src/systems/PrestigeBonusSystem';
import { prestigeBonusBalance as B } from '../../src/data/balance/prestigeBonuses';

/** The multiplier after `n` purchases of a production upgrade: `1 + bonus × n`. */
const after = (bonus: number, n = 1): number => 1 + bonus * n;

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

    it('egg-laying bonus: 1 purchase → 1 + bonus', () => {
      state.prestigeTree.purchased = ['egg_laying_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(after(B.egg_laying), 4);
      // Other bonuses unaffected
      expect(bonuses.hatching).toBe(1.0);
    });

    it('hatching bonus: 1 purchase → 1 + bonus', () => {
      state.prestigeTree.purchased = ['hatching_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.hatching).toBeCloseTo(after(B.hatching), 4);
      expect(bonuses.eggLaying).toBe(1.0);
    });

    it('food bonus: 1 purchase → 1 + bonus', () => {
      state.prestigeTree.purchased = ['food_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.food).toBeCloseTo(after(B.food), 4);
    });

    it('soldier training bonus: 1 purchase → 1 + bonus', () => {
      state.prestigeTree.purchased = ['soldier_training_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.soldierTraining).toBeCloseTo(after(B.soldier_training), 4);
    });

    it('worker efficiency bonus: 1 purchase → 1 + bonus', () => {
      state.prestigeTree.purchased = ['worker_efficiency_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.workerEfficiency).toBeCloseTo(after(B.worker_efficiency), 4);
    });

    // ─── Additive Stacking (same upgrade) ───

    it('same upgrade additive: 2x egg-laying → 1 + 2 × bonus', () => {
      state.prestigeTree.purchased = ['egg_laying_bonus', 'egg_laying_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(after(B.egg_laying, 2), 4);
    });

    it('same upgrade additive: 3x egg-laying → 1 + 3 × bonus', () => {
      state.prestigeTree.purchased = [
        'egg_laying_bonus',
        'egg_laying_bonus',
        'egg_laying_bonus',
      ];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.eggLaying).toBeCloseTo(after(B.egg_laying, 3), 4);
    });

    it('same upgrade additive: 2x worker efficiency → 1 + 2 × bonus', () => {
      state.prestigeTree.purchased = ['worker_efficiency_bonus', 'worker_efficiency_bonus'];
      const bonuses = getPrestigeBonuses(state);
      expect(bonuses.workerEfficiency).toBeCloseTo(after(B.worker_efficiency, 2), 4);
    });

    // ─── Multiplicative Across Different Upgrades ───

    it('different upgrades multiply: each applies on its own', () => {
      state.prestigeTree.purchased = [
        'egg_laying_bonus',
        'egg_laying_bonus',
        'worker_efficiency_bonus',
      ];
      const bonuses = getPrestigeBonuses(state);
      // Each bonus is independent; combined effect in systems = product
      expect(bonuses.eggLaying).toBeCloseTo(after(B.egg_laying, 2), 4);
      expect(bonuses.workerEfficiency).toBeCloseTo(after(B.worker_efficiency), 4);
      // Systems multiply them independently.
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
      expect(bonuses.eggLaying).toBeCloseTo(after(B.egg_laying), 4);
      expect(bonuses.hatching).toBeCloseTo(after(B.hatching), 4);
      expect(bonuses.food).toBeCloseTo(after(B.food), 4);
      expect(bonuses.soldierTraining).toBeCloseTo(after(B.soldier_training), 4);
      expect(bonuses.workerEfficiency).toBeCloseTo(after(B.worker_efficiency), 4);
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
      expect(bonuses.eggLaying).toBeCloseTo(after(B.egg_laying), 4);
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
