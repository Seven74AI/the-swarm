import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { log } from '../../src/utils/log';

/** A local event map: the bus is generic, so its own tests don't depend on game events. */
interface TestEvents {
  'test:event': { value: number };
  'test:isolate': { value: number };
  'test:logged': { value: number };
  'test:prod': Record<string, never>;
  'no:listeners': { value: number };
  nonexistent: { value: number };
  alpha: { value: number };
  beta: { value: number };
}

describe('EventBus', () => {
  it('delivers an emitted event to a subscribed callback', () => {
    const bus = new EventBus<TestEvents>();
    const callback = vi.fn();

    bus.subscribe('test:event', callback);
    bus.emit('test:event', { value: 42 });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ value: 42 });
  });

  it('does not deliver events to unsubscribed callbacks', () => {
    const bus = new EventBus<TestEvents>();
    const callback = vi.fn();

    bus.subscribe('test:event', callback);
    bus.unsubscribe('test:event', callback);
    bus.emit('test:event', { value: 42 });

    expect(callback).not.toHaveBeenCalled();
  });

  it('delivers to all subscribers of the same event', () => {
    const bus = new EventBus<TestEvents>();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    bus.subscribe('test:event', cb1);
    bus.subscribe('test:event', cb2);
    bus.emit('test:event', { value: 42 });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('does not deliver to subscribers of different events', () => {
    const bus = new EventBus<TestEvents>();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    bus.subscribe('alpha', cb1);
    bus.subscribe('beta', cb2);
    bus.emit('alpha', { value: 1 });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('does not throw when emitting an event with no subscribers', () => {
    const bus = new EventBus<TestEvents>();

    expect(() => bus.emit('no:listeners', { value: 1 })).not.toThrow();
  });

  it('does not throw when unsubscribing a callback not registered', () => {
    const bus = new EventBus<TestEvents>();
    const cb = vi.fn();

    expect(() => bus.unsubscribe('nonexistent', cb)).not.toThrow();
  });

  it('isolates errors: one failing callback does not prevent others', () => {
    const bus = new EventBus<TestEvents>();
    const good = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });

    bus.subscribe('test:isolate', good);
    bus.subscribe('test:isolate', bad);

    expect(() => bus.emit('test:isolate', { value: 1 })).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(bad).toHaveBeenCalledTimes(1);
  });

  it('routes a throwing listener to log.error and still runs the others', () => {
    const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});
    const bus = new EventBus<TestEvents>();
    const before = vi.fn();
    const after = vi.fn();
    const boom = new Error('listener boom');

    bus.subscribe('test:logged', before);
    bus.subscribe('test:logged', () => {
      throw boom;
    });
    bus.subscribe('test:logged', after);
    bus.emit('test:logged', { value: 1 });

    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toContain(boom);
    errorSpy.mockRestore();
  });

  it('logs listener errors without relying on process.env (production builds)', () => {
    const errorSpy = vi.spyOn(log, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const bus = new EventBus<TestEvents>();
      bus.subscribe('test:prod', () => {
        throw new Error('prod boom');
      });
      bus.emit('test:prod', {});
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
      errorSpy.mockRestore();
    }
  });
});
