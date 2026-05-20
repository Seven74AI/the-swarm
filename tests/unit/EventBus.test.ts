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

  it('isolates errors: one failing callback does not prevent others', () => {
    const bus = new EventBus();
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

  describe('narrative_event emission', () => {
    it('emits narrative_event alongside system events that have flavors', () => {
      const bus = new EventBus();
      const narrativeCallback = vi.fn();

      bus.subscribe('narrative_event', narrativeCallback);
      bus.registerFlavor('workers_changed', [
        'The colony hums with fifty workers.',
        'Workers march in perfect unison.',
      ]);

      bus.emit('workers_changed', { workers: 50 });

      expect(narrativeCallback).toHaveBeenCalledTimes(1);
      const payload = narrativeCallback.mock.calls[0][0] as {
        type: string;
        flavor: string;
        sourceEvent: string;
      };
      expect(payload.type).toBe('workers_changed');
      expect(payload.sourceEvent).toBe('workers_changed');
      expect([
        'The colony hums with fifty workers.',
        'Workers march in perfect unison.',
      ]).toContain(payload.flavor);
    });

    it('does not emit narrative_event for events without flavors', () => {
      const bus = new EventBus();
      const narrativeCallback = vi.fn();

      bus.subscribe('narrative_event', narrativeCallback);
      bus.emit('unknown_event', { value: 1 });

      expect(narrativeCallback).not.toHaveBeenCalled();
    });

    it('supports deterministic flavor selection with seeded RNG', () => {
      const bus = new EventBus({ seed: 42 });
      const flavors: string[] = [];

      bus.subscribe('narrative_event', (payload: unknown) => {
        const p = payload as { flavor: string };
        flavors.push(p.flavor);
      });

      bus.registerFlavor('phase_changed', [
        'The stars are calling.',
        'A new era begins.',
        'The world shifts beneath our feet.',
      ]);

      // Emit same event 6 times — with same seed, sequence should be reproducible
      for (let i = 0; i < 6; i++) {
        bus.emit('phase_changed', { phase: 'SPACE' });
      }

      // With seed 42, the sequence should be deterministic
      expect(flavors).toHaveLength(6);

      // Verify reproducibility: create another bus with same seed
      const bus2 = new EventBus({ seed: 42 });
      const flavors2: string[] = [];
      bus2.subscribe('narrative_event', (payload: unknown) => {
        const p = payload as { flavor: string };
        flavors2.push(p.flavor);
      });
      bus2.registerFlavor('phase_changed', [
        'The stars are calling.',
        'A new era begins.',
        'The world shifts beneath our feet.',
      ]);

      for (let i = 0; i < 6; i++) {
        bus2.emit('phase_changed', { phase: 'SPACE' });
      }

      expect(flavors).toEqual(flavors2);
    });

    it('cycles through all flavor variants without adjacent repeats', () => {
      const bus = new EventBus({ seed: 123 });
      const flavors: string[] = [];

      bus.subscribe('narrative_event', (payload: unknown) => {
        const p = payload as { flavor: string };
        flavors.push(p.flavor);
      });

      bus.registerFlavor('building_complete', [
        'A new structure rises.',
        'The colony expands its borders.',
        'Stone and wood take shape.',
      ]);

      // Emit 10 times
      for (let i = 0; i < 10; i++) {
        bus.emit('building_complete', { building: 'barracks', level: i + 1 });
      }

      expect(flavors).toHaveLength(10);

      // No two consecutive flavors should be identical
      for (let i = 1; i < flavors.length; i++) {
        expect(flavors[i]).not.toBe(flavors[i - 1]);
      }

      // All three variants should appear at least once
      const unique = new Set(flavors);
      expect(unique.size).toBe(3);
    });

    it('passes source event payload through narrative_event', () => {
      const bus = new EventBus();
      const narrativePayloads: unknown[] = [];

      bus.subscribe('narrative_event', (payload: unknown) => {
        narrativePayloads.push(payload);
      });

      bus.registerFlavor('battle_completed', [
        'The invaders have been routed!',
      ]);

      bus.emit('battle_completed', {
        narrative: 'Victory!',
        food: 23,
        enemyType: 'red_ant',
      });

      expect(narrativePayloads).toHaveLength(1);
      const np = narrativePayloads[0] as Record<string, unknown>;
      const sp = np.sourcePayload as Record<string, unknown>;
      expect(sp.food).toBe(23);
      expect(sp.enemyType).toBe('red_ant');
      expect(np.flavor).toBe('The invaders have been routed!');
    });
  });
});
