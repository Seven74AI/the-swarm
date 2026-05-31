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
    it('logs expedition_launch', () => {
      bus.emit('expedition_launch', { scouts: 2, warriors: 1, destination: 'FOREST' });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('expedition') && e.includes('FOREST'))).toBe(true);
    });

    it('logs expedition_return success', () => {
      bus.emit('expedition_return', {
        destination: 'MEADOW', result: 'success', food: 30, nectar: 10,
        scoutsReturned: 1, warriorsReturned: 2, tilesDiscovered: 2,
      });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('triumphant') && e.includes('MEADOW'))).toBe(true);
    });

    it('logs expedition_return partial with casualties', () => {
      bus.emit('expedition_return', {
        destination: 'MOUNTAIN', result: 'partial', food: 10, stone: 8,
        scoutsReturned: 0, warriorsReturned: 1, tilesDiscovered: 1,
      });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('battered'))).toBe(true);
    });

    it('logs expedition_return failure', () => {
      bus.emit('expedition_return', {
        destination: 'ENEMY NEST', result: 'failure', food: 0, stone: 0,
        scoutsReturned: 0, warriorsReturned: 0, tilesDiscovered: 0,
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
    it('logs soldier_recruited with count', () => {
      bus.emit('soldier_recruited', { type: 'soldier', count: 2 });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('2 soldiers'))).toBe(true);
    });

    it('does not log soldier_recruited with zero count', () => {
      bus.emit('soldier_recruited', { type: 'soldier', count: 0 });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('0 soldier'))).toBe(false);
    });
  });

  describe('phase notifications', () => {
    it('logs colony phase once', () => {
      bus.emit('phase_changed', { phase: 'colony' });
      bus.emit('phase_changed', { phase: 'colony' }); // second should be ignored
      const entries = getEntries();
      const colonyEntries = entries.filter((e) => e.includes('colony takes shape'));
      expect(colonyEntries.length).toBe(1);
    });
  });

  describe('worker milestones', () => {
    it('fires tenth worker milestone once', () => {
      log.notifyWorkerCount(10);
      log.notifyWorkerCount(50); // should not fire again
      const entries = getEntries();
      const humEntries = entries.filter((e) => e.includes('colony hums'));
      expect(humEntries.length).toBe(1);
    });
  });

  describe('append-only DOM (no full rebuild)', () => {
    it('preserves existing DOM nodes when new entries are added', () => {
      // Get initial DOM entry node
      const initialEntries = log.getElement().querySelectorAll('.log-entry');
      expect(initialEntries.length).toBeGreaterThanOrEqual(1);
      const firstNode = initialEntries[0];

      // Add another entry
      bus.emit('expedition_launch', { scouts: 1, warriors: 1, destination: 'GARDEN' });

      // First node should still be the same DOM element (not recreated)
      const afterEntries = log.getElement().querySelectorAll('.log-entry');
      expect(afterEntries[afterEntries.length - 1]).toBe(firstNode); // oldest entry preserved

      // Should have exactly one new entry (not all rebuilt)
      expect(afterEntries.length).toBe(initialEntries.length + 1);
    });

    it('does not recreate DOM nodes when MAX_ENTRIES not exceeded', () => {
      const nodesBefore: Element[] = [];
      // Capture references to first 3 entries
      for (let i = 0; i < 3; i++) {
        bus.emit('soldier_recruited', { type: 'soldier', count: i + 1 });
      }
      const allEntries = log.getElement().querySelectorAll('.log-entry');
      allEntries.forEach((e) => nodesBefore.push(e));

      // Add one more entry
      bus.emit('building_complete', { building: 'nest', level: 2 });

      // All previous nodes should still be in DOM and identical
      const afterEntries = log.getElement().querySelectorAll('.log-entry');
      for (let i = 0; i < nodesBefore.length; i++) {
        // Old nodes shift down by 1 (new entry prepended)
        expect(afterEntries[i + 1]).toBe(nodesBefore[i]);
      }
      // One new node added at top
      expect(afterEntries.length).toBe(nodesBefore.length + 1);
    });
  });
});
