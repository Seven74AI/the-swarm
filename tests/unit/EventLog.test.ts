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

  describe('tile events', () => {
    it('logs tile_discovered with coordinates and type', () => {
      bus.emit('tile_discovered', { x: 3, y: 2, type: 'forest' });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('tile') || e.includes('discovered') || e.includes('forest'))).toBe(true);
    });

    it('logs territory_claimed with coordinates', () => {
      bus.emit('territory_claimed', { x: 3, y: 2, totalTiles: 5 });

      const entries = getEntries();
      expect(entries.some((e) => e.includes('territory') || e.includes('claimed'))).toBe(true);
      expect(entries.some((e) => e.includes('5'))).toBe(true);
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
});
