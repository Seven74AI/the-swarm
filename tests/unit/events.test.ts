import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EventQueue } from '../../src/engine/events';
import { createTickContext } from '../../src/engine/TickContext';

describe('EventQueue', () => {
  it('holds pushed events until flushed to a bus', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.subscribe('eggs_changed', listener);

    const queue = new EventQueue();
    queue.emit('eggs_changed', { eggs: 1 });

    expect(listener).not.toHaveBeenCalled();
    queue.flushTo(bus);
    expect(listener).toHaveBeenCalledWith({ eggs: 1 });
  });

  it('delivers events in the order they were raised', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.subscribe('eggs_changed', () => order.push('eggs'));
    bus.subscribe('phase_changed', () => order.push('phase'));
    bus.subscribe('narrative', () => order.push('narrative'));

    const queue = new EventQueue();
    queue.emit('phase_changed', { phase: 'COLONY' as never });
    queue.emit('eggs_changed', { eggs: 2 });
    queue.emit('narrative', { message: 'x' });
    queue.flushTo(bus);

    expect(order).toEqual(['phase', 'eggs', 'narrative']);
  });

  it('empties after a flush, so an event is delivered once', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.subscribe('workers_changed', listener);

    const queue = new EventQueue();
    queue.emit('workers_changed', { workers: 3 });
    queue.flushTo(bus);
    queue.flushTo(bus);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(0);
  });

  it('clear() drops queued events without delivering them', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.subscribe('workers_changed', listener);

    const queue = new EventQueue();
    queue.emit('workers_changed', { workers: 3 });
    queue.clear();
    queue.flushTo(bus);

    expect(listener).not.toHaveBeenCalled();
  });

  it('a tick context starts with an empty event queue', () => {
    const ctx = createTickContext(0.05);
    expect(ctx.events.size).toBe(0);
    expect(ctx.dtSec).toBeGreaterThan(0);
  });
});

/**
 * Compile-time contract: these lines must stay type errors. If `SwarmEvents`
 * regains a string index signature, or the colon-style names come back, the
 * `@ts-expect-error` directives become unused and `pnpm typecheck` fails.
 */
export function typeContract(bus: EventBus, queue: EventQueue): void {
  // @ts-expect-error: an event that is not in SwarmEvents
  bus.emit('not_a_real_event', {});
  // @ts-expect-error: wrong payload type for a known event
  bus.emit('eggs_changed', { eggs: 'many' });
  // @ts-expect-error: missing payload field
  bus.emit('workers_changed', {});
  // @ts-expect-error: the colon-style name was renamed to egg_clicked
  bus.emit('click:egg', {});
  // @ts-expect-error: the colon-style name was renamed to state_changed
  bus.subscribe('state:changed', () => {});
  // @ts-expect-error: the queue is typed the same way as the bus
  queue.emit('not_a_real_event', {});
}
