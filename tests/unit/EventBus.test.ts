import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';

describe('EventBus', () => {
  it('delivers an emitted event to a subscribed callback', () => {
    const bus = new EventBus();
    const callback = vi.fn();

    bus.subscribe('test:event', callback);
    bus.emit('test:event', { value: 42 });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ value: 42 });
  });

  it('does not deliver events to unsubscribed callbacks', () => {
    const bus = new EventBus();
    const callback = vi.fn();

    bus.subscribe('test:event', callback);
    bus.unsubscribe('test:event', callback);
    bus.emit('test:event', { value: 42 });

    expect(callback).not.toHaveBeenCalled();
  });

  it('delivers to all subscribers of the same event', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    bus.subscribe('test:event', cb1);
    bus.subscribe('test:event', cb2);
    bus.emit('test:event', { value: 42 });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('does not deliver to subscribers of different events', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    bus.subscribe('alpha', cb1);
    bus.subscribe('beta', cb2);
    bus.emit('alpha', { value: 1 });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('does not throw when emitting an event with no subscribers', () => {
    const bus = new EventBus();

    expect(() => bus.emit('no:listeners', { value: 1 })).not.toThrow();
  });

  it('does not throw when unsubscribing a callback not registered', () => {
    const bus = new EventBus();
    const cb = vi.fn();

    expect(() => bus.unsubscribe('nonexistent', cb)).not.toThrow();
  });
});
