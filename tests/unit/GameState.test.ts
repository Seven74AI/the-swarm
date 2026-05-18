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
