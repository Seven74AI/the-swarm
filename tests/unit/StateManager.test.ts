import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { StateManager } from '../../src/state/StateManager';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('StateManager', () => {
  it('getState returns the current state', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);

    const state = manager.getState();
    expect(state.phase).toBe('egg_laying');
    expect(state.resources.eggs).toBe(0);
  });

  it('update merges partial state immutably', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const original = manager.getState();

    const updated = manager.update({ resources: { eggs: 5 } });

    expect(updated.resources.eggs).toBe(5);
    expect(original.resources.eggs).toBe(0);
    expect(updated).not.toBe(original);
  });

  it('update preserves other resource fields on partial update', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);

    manager.update({ resources: { eggs: 10 } });
    const state = manager.getState();

    expect(state.resources.eggs).toBe(10);
    expect(state.resources.larvae).toBe(0);
    expect(state.resources.workers).toBe(0);
    expect(state.resources.food).toBe(0);
    expect(state.resources.nestCapacity).toBe(25);
  });

  it('emits state:changed event on update', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('state:changed', callback);

    const manager = new StateManager(bus);
    manager.update({ resources: { eggs: 3 } });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('state:changed payload contains the updated state', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('state:changed', callback);

    const manager = new StateManager(bus);
    const updated = manager.update({ phase: 'colony' });

    expect(callback).toHaveBeenCalledWith(updated);
  });

  it('subscribe notifies callback on every update', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const callback = vi.fn();

    manager.subscribe(callback);
    manager.update({ resources: { eggs: 1 } });
    manager.update({ resources: { eggs: 2 } });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('subscribe receives the full updated state', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    let received: GameState | null = null;

    manager.subscribe((state) => {
      received = state;
    });

    const updated = manager.update({ resources: { food: 42 } });
    expect(received).toBe(updated);
  });
});
