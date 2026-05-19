import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/state/GameState';

describe('createInitialState', () => {
  it('returns a fresh game state with phase egg_laying', () => {
    const state = createInitialState();

    expect(state.phase).toBe('egg_laying');
  });

  it('initializes resources to zero', () => {
    const state = createInitialState();

    expect(state.resources.eggs).toBe(0);
    expect(state.resources.larvae).toBe(0);
    expect(state.resources.workers).toBe(0);
    expect(state.resources.food).toBe(0);
  });

  it('starts with a nest capacity of 25', () => {
    const state = createInitialState();

    expect(state.resources.nestCapacity).toBe(25);
  });

  it('initializes workersAssigned all to zero', () => {
    const state = createInitialState();

    expect(state.workersAssigned.gather).toBe(0);
    expect(state.workersAssigned.tend).toBe(0);
    expect(state.workersAssigned.dig).toBe(0);
    expect(state.workersAssigned.guard).toBe(0);
  });

  it('initializes upgrades as an empty object', () => {
    const state = createInitialState();

    expect(state.upgrades).toEqual({});
  });

  it('initializes stats to zero', () => {
    const state = createInitialState();

    expect(state.stats.totalEggsLaid).toBe(0);
    expect(state.stats.totalClicks).toBe(0);
    expect(state.stats.playTimeMs).toBe(0);
  });

  it('has no unlocked panels', () => {
    const state = createInitialState();

    expect(state.unlockedPanels).toEqual([]);
  });

  it('returns a new object each call (immutability guard)', () => {
    const a = createInitialState();
    const b = createInitialState();

    expect(a).not.toBe(b);
    expect(a.resources).not.toBe(b.resources);
    expect(a.workersAssigned).not.toBe(b.workersAssigned);
    expect(a.stats).not.toBe(b.stats);
    expect(a.upgrades).not.toBe(b.upgrades);
  });
});

describe('Phase 3 expansion fields', () => {
  it('initializes new resources (wood, stone, nectar) to 0', () => {
    const state = createInitialState();
    expect(state.resources.wood).toBe(0);
    expect(state.resources.stone).toBe(0);
    expect(state.resources.nectar).toBe(0);
  });

  it('initializes soldiers data with defaults', () => {
    const state = createInitialState();
    expect(state.soldiers).toBeDefined();
    expect(state.soldiers.scouts).toBe(0);
    expect(state.soldiers.warriors).toBe(0);
    expect(state.soldiers.totalKilled).toBe(0);
  });

  it('initializes buildings with default level 0', () => {
    const state = createInitialState();
    expect(state.buildings).toBeDefined();
    expect(state.buildings.barracks.level).toBe(0);
    expect(state.buildings.barracks.count).toBe(0);
    expect(state.buildings.walls.level).toBe(0);
    expect(state.buildings.warehouse.level).toBe(0);
  });

  it('initializes territory with defaults', () => {
    const state = createInitialState();
    expect(state.territory).toBeDefined();
    expect(state.territory.ownedTiles).toBe(0);
    expect(state.territory.bonuses).toEqual({});
  });

  it('initializes expeditions as empty array', () => {
    const state = createInitialState();
    expect(state.expeditions).toBeDefined();
    expect(state.expeditions).toEqual([]);
  });

  it('initializes space resources (voidCrystals, antimatter, darkMatter) to 0', () => {
    const state = createInitialState();
    expect(state.resources.voidCrystals).toBe(0);
    expect(state.resources.antimatter).toBe(0);
    expect(state.resources.darkMatter).toBe(0);
  });

  it('initializes victoryAchieved to false', () => {
    const state = createInitialState();
    expect(state.victoryAchieved).toBe(false);
  });

  it('new fields are independent copies (immutability)', () => {
    const a = createInitialState();
    const b = createInitialState();
    expect(a.soldiers).not.toBe(b.soldiers);
    expect(a.buildings).not.toBe(b.buildings);
    expect(a.territory).not.toBe(b.territory);
    expect(a.expeditions).not.toBe(b.expeditions);
  });
});
