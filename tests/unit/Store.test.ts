import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { StateManager } from '../../src/state/StateManager';
import { Store } from '../../src/state/Store';

describe('Store', () => {
  it('reads a top-level key from state', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const store = new Store(manager);

    expect(store.read('phase')).toBe('egg_laying');
  });

  it('reads a nested key from state', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const store = new Store(manager);

    expect(store.read('resources.eggs')).toBe(0);
    expect(store.read('resources.nestCapacity')).toBe(25);
  });

  it('subscribe notifies when the subscribed slice changes', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const store = new Store(manager);
    const callback = vi.fn();

    store.subscribe('resources.eggs', callback);
    manager.update({ resources: { eggs: 5 } });

    expect(callback).toHaveBeenCalledWith(5);
  });

  it('subscribe does not notify when a different slice changes', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const store = new Store(manager);
    const eggsCallback = vi.fn();
    const foodCallback = vi.fn();

    store.subscribe('resources.eggs', eggsCallback);
    store.subscribe('resources.food', foodCallback);
    manager.update({ resources: { food: 10 } });

    expect(eggsCallback).not.toHaveBeenCalled();
    expect(foodCallback).toHaveBeenCalledWith(10);
  });

  it('subscribe notifies when a parent is updated', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const store = new Store(manager);
    const callback = vi.fn();

    store.subscribe('resources.eggs', callback);
    manager.update({
      resources: { eggs: 3, larvae: 2, workers: 1, food: 10, nestCapacity: 25 },
    });

    expect(callback).toHaveBeenCalledWith(3);
  });

  it('unsubscribe stops notifications', () => {
    const bus = new EventBus();
    const manager = new StateManager(bus);
    const store = new Store(manager);
    const callback = vi.fn();

    store.subscribe('resources.eggs', callback);
    store.unsubscribe('resources.eggs', callback);
    manager.update({ resources: { eggs: 5 } });

    expect(callback).not.toHaveBeenCalled();
  });
});
