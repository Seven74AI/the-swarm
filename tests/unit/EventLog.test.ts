import { describe, it, expect, beforeEach } from 'vitest';
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

  function getLatestEntry(): string {
    const entries = log.getElement().querySelectorAll('.log-entry');
    return entries.length > 0 ? entries[0].textContent ?? '' : '';
  }

  // ── Ground expeditions (unchanged) ──
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

  // ── Soldier recruitment removed (was spam) ──
  describe('soldier_recruited — removed (spam)', () => {
    it('does NOT log soldier_recruited', () => {
      const before = getEntries().length;
      bus.emit('soldier_recruited', { type: 'soldier', count: 2 });
      const after = getEntries().length;
      expect(after).toBe(before);
    });

    it('does not log even for large batches', () => {
      bus.emit('soldier_recruited', { type: 'soldier', count: 50 });
      const entries = getEntries();
      const soldierEntries = entries.filter((e) => e.includes('soldier') && e.includes('training'));
      expect(soldierEntries).toHaveLength(0);
    });

    it('zero-count no longer appears either', () => {
      bus.emit('soldier_recruited', { type: 'soldier', count: 0 });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('0 soldier'))).toBe(false);
    });
  });

  // ── Building events — first-unlock distinction ──
  describe('building events', () => {
    it('logs construction message for first unlock (level 1)', () => {
      bus.emit('building_complete', { building: 'barracks', level: 1 });
      const msg = getLatestEntry();
      expect(msg).toContain('Barracks constructed');
      expect(msg).toContain('new building rises');
    });

    it('logs upgrade message for level > 1', () => {
      bus.emit('building_complete', { building: 'barracks', level: 3 });
      const msg = getLatestEntry();
      expect(msg).toContain('Barracks upgraded to level 3');
      expect(msg).toContain('grows stronger');
    });
  });

  // ── Space exploration return ──
  describe('exploration_return — space scouts', () => {
    it('logs scouts return with space resources on success', () => {
      bus.emit('exploration_return', {
        destination: 'Mars',
        result: 'success',
        voidCrystals: 5,
        antimatter: 2,
        darkMatter: 0,
      });
      const msg = getLatestEntry();
      expect(msg).toContain('Scouts return from Mars');
      expect(msg).toContain('5 void crystals');
      expect(msg).toContain('2 antimatter');
    });

    it('logs scouts return on partial', () => {
      bus.emit('exploration_return', {
        destination: 'Venus',
        result: 'partial',
        voidCrystals: 1,
        antimatter: 0,
        darkMatter: 3,
      });
      const msg = getLatestEntry();
      expect(msg).toContain('Scouts return from Venus');
      expect(msg).toContain('3 dark matter');
    });

    it('logs failure when no resources gained', () => {
      bus.emit('exploration_return', {
        destination: 'Jupiter',
        result: 'failure',
        voidCrystals: 0,
        antimatter: 0,
        darkMatter: 0,
      });
      const msg = getLatestEntry();
      expect(msg).toContain('Scouts return from Jupiter');
      expect(msg).toContain('yielded nothing');
    });

    it('does not mention zero-value resources', () => {
      bus.emit('exploration_return', {
        destination: 'Saturn',
        result: 'success',
        voidCrystals: 0,
        antimatter: 7,
        darkMatter: 0,
      });
      const msg = getLatestEntry();
      expect(msg).toContain('7 antimatter');
      expect(msg).not.toContain('void crystals');
      expect(msg).not.toContain('dark matter');
    });
  });

  // ── Probe launch ──
  describe('probe_launch', () => {
    it('logs probe launch with destination', () => {
      bus.emit('probe_launch', {
        id: 'probe_123',
        destination: 'Alpha Centauri',
        ticksRemaining: 42,
        scouts: 1,
      });
      const msg = getLatestEntry();
      expect(msg).toContain('Probe launched toward Alpha Centauri');
    });
  });

  // ── Narrative messages ──
  describe('narrative', () => {
    it('logs combat narrative from phase transition', () => {
      bus.emit('narrative', {
        message:
          'The colony faces its first threat. Guards are posted. The age of innocence is over.',
      });
      const msg = getLatestEntry();
      expect(msg).toContain('age of innocence');
    });

    it('logs space-age narrative', () => {
      bus.emit('narrative', {
        message:
          'The colony looks to the heavens. Rockets thunder skyward. The age of space has begun.',
      });
      const msg = getLatestEntry();
      expect(msg).toContain('age of space');
    });
  });

  // ── Phase notifications (unchanged) ──
  describe('phase notifications', () => {
    it('logs colony phase once', () => {
      bus.emit('phase_changed', { phase: 'colony' });
      bus.emit('phase_changed', { phase: 'colony' }); // second should be ignored
      const entries = getEntries();
      const colonyEntries = entries.filter((e) => e.includes('colony takes shape'));
      expect(colonyEntries.length).toBe(1);
    });
  });

  // ── Worker milestones (unchanged) ──
  describe('worker milestones', () => {
    it('fires tenth worker milestone once', () => {
      log.notifyWorkerCount(10);
      log.notifyWorkerCount(50); // should not fire again
      const entries = getEntries();
      const humEntries = entries.filter((e) => e.includes('colony hums'));
      expect(humEntries.length).toBe(1);
    });
  });

  // ── Destroy cleanup ──
  describe('destroy — cleanup', () => {
    it('unsubscribes all handlers so no events leak after destroy', () => {
      const before = getEntries().length;
      log.destroy();
      bus.emit('probe_launch', { id: 'p', destination: 'X', ticksRemaining: 1, scouts: 1 });
      bus.emit('exploration_return', {
        destination: 'X', result: 'success',
        voidCrystals: 1, antimatter: 0, darkMatter: 0,
      });
      bus.emit('narrative', { message: 'should not appear' });
      const after = getEntries().length;
      expect(after).toBe(before);
    });
  });

  // ── Append-only DOM (unchanged, but updated to avoid soldier_recruited) ──
  describe('append-only DOM (no full rebuild)', () => {
    it('preserves existing DOM nodes when new entries are added', () => {
      const initialEntries = log.getElement().querySelectorAll('.log-entry');
      expect(initialEntries.length).toBeGreaterThanOrEqual(1);
      const firstNode = initialEntries[0];

      bus.emit('expedition_launch', { scouts: 1, warriors: 1, destination: 'GARDEN' });

      const afterEntries = log.getElement().querySelectorAll('.log-entry');
      expect(afterEntries[afterEntries.length - 1]).toBe(firstNode); // oldest entry preserved
      expect(afterEntries.length).toBe(initialEntries.length + 1);
    });

    it('does not recreate DOM nodes when MAX_ENTRIES not exceeded', () => {
      const nodesBefore: Element[] = [];
      // Use building_complete instead of removed soldier_recruited
      for (let i = 0; i < 3; i++) {
        bus.emit('building_complete', { building: 'nest', level: i + 1 });
      }
      const allEntries = log.getElement().querySelectorAll('.log-entry');
      allEntries.forEach((e) => nodesBefore.push(e));

      bus.emit('building_complete', { building: 'hatchery', level: 1 });

      const afterEntries = log.getElement().querySelectorAll('.log-entry');
      for (let i = 0; i < nodesBefore.length; i++) {
        expect(afterEntries[i + 1]).toBe(nodesBefore[i]);
      }
      expect(afterEntries.length).toBe(nodesBefore.length + 1);
    });
  });
});
