import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePrestigePoints, getPhaseMultiplier } from '../../src/systems/PrestigeCalculator';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';

describe('PrestigeCalculator', () => {
  describe('calculatePrestigePoints', () => {
    it('returns 0 when totalLifetimeResources is 0', () => {
      expect(calculatePrestigePoints(0, 'egg_laying')).toBe(0);
    });

    it('returns 0 when totalLifetimeResources is negative', () => {
      expect(calculatePrestigePoints(-100, 'colony')).toBe(0);
    });

    it('returns 0 when totalLifetimeResources is below the threshold', () => {
      // sqrt(999/1000) * 1.0 = sqrt(0.999) = 0.9995 → floor = 0
      expect(calculatePrestigePoints(999, 'egg_laying')).toBe(0);
    });

    it('returns positive points at exactly 1000 resources in phase 1', () => {
      // sqrt(1000/1000) * 1.0 = 1.0 → floor = 1
      const points = calculatePrestigePoints(1000, 'egg_laying');
      expect(points).toBe(1);
    });

    it('higher total resources produce more points (invariant)', () => {
      const low = calculatePrestigePoints(5000, 'egg_laying');
      const high = calculatePrestigePoints(10000, 'egg_laying');
      expect(high).toBeGreaterThan(low);
    });

    it('higher phase produces higher multiplier (invariant)', () => {
      const phase1 = calculatePrestigePoints(10000, 'egg_laying');
      const phase3 = calculatePrestigePoints(10000, 'combat');
      expect(phase3).toBeGreaterThan(phase1);
    });

    it('phase 2 multiplier is 1.375', () => {
      // sqrt(10000/1000) * 1.375 = sqrt(10) * 1.375 = 3.162 * 1.375 = 4.348 → floor = 4
      const points = calculatePrestigePoints(10000, 'colony');
      expect(points).toBe(4);
    });

    it('phase 3 multiplier is 1.75', () => {
      // sqrt(10000/1000) * 1.75 = 3.162 * 1.75 = 5.534 → floor = 5
      const points = calculatePrestigePoints(10000, 'combat');
      expect(points).toBe(5);
    });

    it('phase 4 multiplier is 2.125', () => {
      // sqrt(10000/1000) * 2.125 = 3.162 * 2.125 = 6.719 → floor = 6
      const points = calculatePrestigePoints(10000, 'expansion');
      expect(points).toBe(6);
    });

    it('phase 5 multiplier is 2.5', () => {
      // sqrt(10000/1000) * 2.5 = 3.162 * 2.5 = 7.906 → floor = 7
      const points = calculatePrestigePoints(10000, 'space');
      expect(points).toBe(7);
    });

    it('transcendence phase caps at phase 5 multiplier (2.5)', () => {
      const space = calculatePrestigePoints(10000, 'space');
      const transcendence = calculatePrestigePoints(10000, 'transcendence');
      expect(transcendence).toBe(space);
    });

    it('unknown phase defaults to multiplier 1.0', () => {
      // sqrt(10000/1000) * 1.0 = 3.162 → floor = 3
      const points = calculatePrestigePoints(10000, 'unknown_phase');
      expect(points).toBe(3);
    });

    it('result is always an integer (Resource Integer Rule)', () => {
      const points = calculatePrestigePoints(54321, 'combat');
      expect(Number.isInteger(points)).toBe(true);
    });

    it('phase 1 returns floor(sqrt(N/1000))', () => {
      const points = calculatePrestigePoints(16000, 'egg_laying');
      // sqrt(16000/1000) * 1.0 = sqrt(16) = 4 → floor = 4
      expect(points).toBe(4);
    });
  });

  describe('getPhaseMultiplier', () => {
    it('returns 1.0 for phase 1', () => {
      expect(getPhaseMultiplier('egg_laying')).toBe(1.0);
    });

    it('returns 1.375 for phase 2', () => {
      expect(getPhaseMultiplier('colony')).toBe(1.375);
    });

    it('returns 1.75 for phase 3', () => {
      expect(getPhaseMultiplier('combat')).toBe(1.75);
    });

    it('returns 2.125 for phase 4', () => {
      expect(getPhaseMultiplier('expansion')).toBe(2.125);
    });

    it('returns 2.5 for phase 5', () => {
      expect(getPhaseMultiplier('space')).toBe(2.5);
    });

    it('caps at 2.5 for transcendence', () => {
      expect(getPhaseMultiplier('transcendence')).toBe(2.5);
    });

    it('returns 1.0 for unknown phase', () => {
      expect(getPhaseMultiplier('unknown')).toBe(1.0);
    });
  });
});

describe('GameState prestige fields', () => {
  it('createInitialState has all new prestige fields with correct defaults', () => {
    const state = createInitialState();
    expect(state.prestigeCount).toBe(0);
    expect(state.prestigePoints).toBe(0);
    expect(state.purchasedUpgrades).toEqual([]);
    expect(state.totalLifetimeResources).toBe(0);
  });

  it('existing prestige object is unchanged', () => {
    const state = createInitialState();
    expect(state.prestige).toBeDefined();
    expect(state.prestige.count).toBe(0);
    expect(state.prestige.legacyPoints).toBe(0);
    expect(state.prestige.totalFoodProduced).toBe(0);
  });
});

describe('Save migration v10→v11', () => {
  it('migrates v10 to v11 adding new prestige fields with defaults', () => {
    const state = createInitialState();
    const v10Data: SaveData = {
      version: 10,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v11Data = migrateSave(v10Data, 10, 11);
    const gs = v11Data.gameState as unknown as Record<string, unknown>;

    expect(v11Data.version).toBe(11);
    expect(gs.prestigeCount).toBe(0);
    expect(gs.prestigePoints).toBe(0);
    expect(gs.purchasedUpgrades).toEqual([]);
    expect(gs.totalLifetimeResources).toBe(0);
  });

  it('migrates v10 to v11 preserving existing game state', () => {
    const state = createInitialState();
    state.resources.food = 5000;
    state.resources.workers = 25;
    state.phase = 'colony';
    state.prestige.count = 3;
    state.prestige.legacyPoints = 15;
    state.prestige.totalFoodProduced = 200_000;

    const v10Data: SaveData = {
      version: 10,
      timestamp: 1234567890,
      playTimeMs: 60000,
      gameState: state,
    };

    const v11Data = migrateSave(v10Data, 10, 11);
    const gs = v11Data.gameState as unknown as Record<string, unknown>;

    expect(v11Data.version).toBe(11);
    expect((gs.resources as Record<string, unknown>).food).toBe(5000);
    expect(gs.phase).toBe('colony');

    // Existing prestige object untouched
    const prestige = gs.prestige as Record<string, unknown>;
    expect(prestige.count).toBe(3);
    expect(prestige.legacyPoints).toBe(15);
    expect(prestige.totalFoodProduced).toBe(200_000);

    // New fields initialized to defaults
    expect(gs.prestigeCount).toBe(0);
    expect(gs.prestigePoints).toBe(0);
    expect(gs.purchasedUpgrades).toEqual([]);
    expect(gs.totalLifetimeResources).toBe(0);
  });

  it('chains v1→v11 correctly (all migrations work together)', () => {
    const state = createInitialState();
    const v1Data: SaveData = {
      version: 1,
      timestamp: 1234567890,
      playTimeMs: 10000,
      gameState: state,
    };

    const v11Data = migrateSave(v1Data, 1, 11);
    const gs = v11Data.gameState as unknown as Record<string, unknown>;

    // Should have gone through ALL migrations
    expect(v11Data.version).toBe(11);

    // New prestige fields present
    expect(gs.prestigeCount).toBe(0);
    expect(gs.prestigePoints).toBe(0);
    expect(gs.purchasedUpgrades).toEqual([]);
    expect(gs.totalLifetimeResources).toBe(0);

    // Legacy prestige also present (from v7→v8 migration)
    const prestige = gs.prestige as Record<string, unknown>;
    expect(prestige).toBeDefined();
  });

  it('save data other than gameState is preserved', () => {
    const state = createInitialState();
    const v10Data: SaveData = {
      version: 10,
      timestamp: 9876543210,
      playTimeMs: 123456,
      gameState: state,
    };

    const v11Data = migrateSave(v10Data, 10, 11);

    expect(v11Data.timestamp).toBe(9876543210);
    expect(v11Data.playTimeMs).toBe(123456);
  });
});
