import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventLog } from '../../src/ui/panels/EventLog';
import { EventBus } from '../../src/engine/EventBus';

describe('EventLog', () => {
  let bus: EventBus;
  let log: EventLog;

  beforeEach(() => {
    bus = new EventBus();
    log = new EventLog(bus);
  });

  function getEntries(): string[] {
    const el = log.getElement();
    const entries = el.querySelectorAll('.log-entry');
    return Array.from(entries).map((e) => e.textContent ?? '');
  }

  describe('expedition events', () => {
    it('logs expedition_launch with flavor text', () => {
      bus.emit('expedition_launch', { scouts: 2, warriors: 1, destination: 'FOREST' });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('expedition') && e.includes('FOREST'))).toBe(true);
    });

    it('logs expedition_return success with flavor text', () => {
      bus.emit('expedition_return', {
        destination: 'MEADOW',
        result: 'success',
        food: 30,
        nectar: 10,
        scoutsReturned: 1,
        warriorsReturned: 2,
        tilesDiscovered: 2,
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('triumphant') && e.includes('MEADOW'))).toBe(true);
      expect(entries.some((e) => e.includes('30'))).toBe(true);
    });

    it('logs expedition_return partial with casualties', () => {
      bus.emit('expedition_return', {
        destination: 'MOUNTAIN',
        result: 'partial',
        food: 10,
        stone: 8,
        scoutsReturned: 0,
        warriorsReturned: 1,
        tilesDiscovered: 1,
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('battered'))).toBe(true);
    });

    it('logs expedition_return failure', () => {
      bus.emit('expedition_return', {
        destination: 'ENEMY NEST',
        result: 'failure',
        food: 0,
        stone: 0,
        scoutsReturned: 0,
        warriorsReturned: 0,
        tilesDiscovered: 0,
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('lost') || e.includes('No one returned'))).toBe(true);
    });
  });

  describe('building events', () => {
    it('logs building_complete with building type and level', () => {
      bus.emit('building_complete', { building: 'barracks', level: 1 });

      const entries = getEntries();
      expect(entries.some((e) => e.toLowerCase().includes('barracks'))).toBe(true);
    });
  });

  describe('soldier events', () => {
    it('logs soldier_recruited', () => {
      bus.emit('soldier_recruited', { type: 'scout', count: 2 });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('scout') || e.includes('soldier') || e.includes('recruited'))).toBe(true);
    });
  });

  describe('narrative_event rendering', () => {
    it('renders narrative_event flavor text in the log', () => {
      bus.emit('narrative_event', {
        type: 'phase_changed',
        flavor: 'The stars are calling. The workers look up at the night sky.',
        sourceEvent: 'phase_changed',
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('The stars are calling'))).toBe(true);
    });

    it('renders narrative event with worker count flavor', () => {
      bus.emit('narrative_event', {
        type: 'workers_changed',
        flavor: 'Fifty workers now serve the colony. The tunnels echo with industry.',
        sourceEvent: 'workers_changed',
        workers: 50,
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('Fifty workers'))).toBe(true);
      expect(entries.some((e) => e.includes('industry'))).toBe(true);
    });

    it('renders narrative event with battle result flavor', () => {
      bus.emit('narrative_event', {
        type: 'battle_completed',
        flavor: 'The red ant invaders have been routed! +23 🍞 scavenged from their corpses.',
        sourceEvent: 'battle_completed',
        food: 23,
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('routed'))).toBe(true);
    });

    it('renders narrative event with resource milestone flavor', () => {
      bus.emit('narrative_event', {
        type: 'resource_milestone',
        flavor: "The colony's food stores have reached a new peak. Winter holds no fear.",
        sourceEvent: 'resource_milestone',
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('Winter holds no fear'))).toBe(true);
    });

    it('renders narrative event with building built flavor', () => {
      bus.emit('narrative_event', {
        type: 'building_complete',
        flavor: 'A new structure rises from the earth. The colony borders expand once more.',
        sourceEvent: 'building_complete',
      });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('rises from the earth'))).toBe(true);
    });

    it('auto-emits narrative_event when system event with registered flavor fires', () => {
      // When building_complete is emitted, EventBus auto-emits narrative_event
      // because building_complete has registered flavors.
      // The EventLog should show both the system entry and the narrative flavor.
      bus.registerFlavor('building_complete', [
        'A new structure rises from the earth.',
      ]);
      bus.emit('building_complete', { building: 'barracks', level: 2 });

      const entries = getEntries();
      // Both entries should exist: system event text + narrative flavor
      expect(entries.length).toBeGreaterThanOrEqual(2);
      const narrativeCount = entries.filter((e) => e.includes('rises from the earth')).length;
      // The narrative entry appears exactly once per emission
      expect(narrativeCount).toBe(1);
      // System entry also present
      expect(entries.some((e) => e.includes('Barracks') && e.includes('level 2'))).toBe(true);
    });
  });
});
