import { describe, it, expect } from 'vitest';
import { GameStatePool } from '../../src/state/GameStatePool';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('GameStatePool', () => {
  it('pre-allocates exactly capacity objects on construction', () => {
    const pool = new GameStatePool(5);
    expect(pool.size).toBe(5);
    expect(pool.capacity).toBe(5);
  });

  it('checkout returns a valid GameState object', () => {
    const pool = new GameStatePool(3);
    const state = pool.checkout();
    expect(state).toBeDefined();
    expect(state.phase).toBe('egg_laying');
    expect(state.resources.eggs).toBe(0);
    expect(state.stats.totalClicks).toBe(0);
  });

  it('checkout reduces pool size by one', () => {
    const pool = new GameStatePool(5);
    expect(pool.size).toBe(5);
    const state = pool.checkout();
    expect(pool.size).toBe(4);
    // Variable is used — just verifying pool behavior
    void state;
  });

  it('checkin increases pool size by one', () => {
    const pool = new GameStatePool(5);
    const state = pool.checkout();
    expect(pool.size).toBe(4);
    pool.checkin(state);
    expect(pool.size).toBe(5);
  });

  it('checkout after checkin returns the same object (identity reuse)', () => {
    const pool = new GameStatePool(3);
    const state1 = pool.checkout();
    pool.checkin(state1);
    const state2 = pool.checkout();
    // Same object reference — the pool reuses, not re-creates
    expect(state2).toBe(state1);
  });

  it('checkout when pool is empty creates a new object (miss)', () => {
    const pool = new GameStatePool(2);
    // Drain the pool
    pool.checkout();
    pool.checkout();
    expect(pool.size).toBe(0);
    expect(pool.misses).toBe(0);

    // Next checkout should be a miss
    const state = pool.checkout();
    expect(state).toBeDefined();
    expect(pool.misses).toBe(1);
    expect(pool.hits).toBe(2);
  });

  it('checkin when pool is full drops the object', () => {
    const pool = new GameStatePool(2);
    // Pool is already full — checkin should drop
    const extra = createInitialState();
    pool.checkin(extra);
    expect(pool.size).toBe(2); // Still at capacity
    expect(pool.drops).toBe(1);
    expect(pool.frees).toBe(0);
  });

  it('hits counter increments on successful checkout', () => {
    const pool = new GameStatePool(3);
    expect(pool.hits).toBe(0);
    pool.checkout();
    expect(pool.hits).toBe(1);
    pool.checkout();
    expect(pool.hits).toBe(2);
  });

  it('frees counter increments on successful checkin', () => {
    const pool = new GameStatePool(3);
    const state = pool.checkout();
    expect(pool.frees).toBe(0);
    pool.checkin(state);
    expect(pool.frees).toBe(1);
  });

  it('spread copies fields from source and applies changes', () => {
    const pool = new GameStatePool(3);
    const source = createInitialState();
    source.resources.eggs = 10;
    source.stats.totalClicks = 5;

    const result = pool.spread(source, {
      resources: {
        ...source.resources,
        larvae: 3,
      },
    });

    // Changes applied
    expect(result.resources.eggs).toBe(10);
    expect(result.resources.larvae).toBe(3);
    expect(result.stats.totalClicks).toBe(5);

    // Result is a different object from source
    expect(result).not.toBe(source);
  });

  it('spread recycles the source object (source checked in after copy)', () => {
    const pool = new GameStatePool(3);
    const initialSize = pool.size;

    const source = createInitialState();
    source.resources.eggs = 42;

    pool.spread(source, {
      stats: {
        ...source.stats,
        totalClicks: 1,
      },
    });

    // Source was checked in — pool size should be back to initial
    // (one checked out, one checked in = net zero change)
    expect(pool.size).toBe(initialSize);
    // frees should have incremented
    expect(pool.frees).toBeGreaterThanOrEqual(1);
  });

  it('spread handles empty changes (identity copy)', () => {
    const pool = new GameStatePool(3);
    const source = createInitialState();
    source.resources.eggs = 99;

    const result = pool.spread(source, {});

    // All fields should match source
    expect(result.resources.eggs).toBe(99);
    expect(result.phase).toBe(source.phase);
    expect(result).not.toBe(source);
  });

  it('swap checks in oldState and returns newState', () => {
    const pool = new GameStatePool(3);
    const oldState = pool.checkout();
    const newState = createInitialState();
    newState.resources.eggs = 100;

    const returned = pool.swap(oldState, newState);

    expect(returned).toBe(newState);
    // oldState was checked back in
    expect(pool.size).toBeGreaterThanOrEqual(2);
  });

  it('standalone pool instance works end-to-end', () => {
    const pool = new GameStatePool(10);
    expect(pool.capacity).toBe(10);
    expect(pool.size).toBe(10);

    // Simulate a few tick cycles
    const states: GameState[] = [];
    for (let i = 0; i < 5; i++) {
      states.push(pool.checkout());
    }
    expect(pool.size).toBe(5);
    expect(pool.hits).toBe(5);

    // Return them
    for (const s of states) {
      pool.checkin(s);
    }
    expect(pool.size).toBe(10);
    expect(pool.frees).toBe(5);
  });

  it('misses occur when pool is exhausted, but valid states are still returned', () => {
    const pool = new GameStatePool(3);
    // Drain
    for (let i = 0; i < 3; i++) pool.checkout();
    expect(pool.size).toBe(0);

    // 10 more checkouts — all should be misses but still return valid states
    for (let i = 0; i < 10; i++) {
      const s = pool.checkout();
      expect(s).toBeDefined();
      expect(s.phase).toBeDefined();
    }
    expect(pool.misses).toBe(10);
  });

  it('default pool size is 10', () => {
    const pool = new GameStatePool();
    expect(pool.capacity).toBe(10);
    expect(pool.size).toBe(10);
  });
});
