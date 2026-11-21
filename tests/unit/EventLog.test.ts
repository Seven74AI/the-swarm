import { describe, it, expect, beforeEach } from 'vitest';
import { EventLog } from '../../src/ui/panels/EventLog';
import { EventBus } from '../../src/engine/EventBus';
import { Phase } from '../../src/phases/phases';
import { getDecision } from '../../src/data/content/decisions';
import { COLONY_LINES } from '../../src/data/content/colonyLines';

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

  // ── Decision events (Story 1.28) ──
  describe('decision events', () => {
    it('logs a costly timeout with its outcome', () => {
      const def = getDecision('overcrowding');
      bus.emit('decision_resolved', { id: def.id, choice: 'ignore', timedOut: true, policy: 'costly' });
      expect(getLatestEntry()).toContain(def.ignoreLine);
    });

    it('does not log a free timeout as a loss', () => {
      const before = getEntries().length;
      bus.emit('decision_resolved', { id: 'beetle_sighting', choice: 'ignore', timedOut: true, policy: 'free' });
      expect(getEntries().length).toBe(before);
    });
  });

  // ── Ground expeditions (unchanged) ──
  describe('expedition events', () => {
    it('logs expedition_launch', () => {
      bus.emit('expedition_launch', { scouts: 2, warriors: 1, destination: 'FOREST' });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('EXPEDITION') && e.includes('FOREST') && e.includes('2 SCOUTS AND 1 WARRIOR'))).toBe(true);
    });

    it('logs expedition_return success', () => {
      bus.emit('expedition_return', {
        destination: 'MEADOW', result: 'success', food: 30, stone: 0, nectar: 10, wood: 0,
        scoutsReturned: 1, warriorsReturned: 2, tilesDiscovered: 2,
      });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('RETURNS FROM MEADOW') && e.includes('30 FOOD'))).toBe(true);
    });

    it('logs expedition_return partial with casualties', () => {
      bus.emit('expedition_return', {
        destination: 'MOUNTAIN', result: 'partial', food: 10, stone: 8, nectar: 0, wood: 0,
        scoutsReturned: 0, warriorsReturned: 1, tilesDiscovered: 1,
      });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('LIMPS BACK FROM MOUNTAIN') && e.includes('1 WARRIOR'))).toBe(true);
    });

    it('logs expedition_return failure', () => {
      bus.emit('expedition_return', {
        destination: 'ENEMY NEST', result: 'failure', food: 0, stone: 0, nectar: 0, wood: 0,
        scoutsReturned: 0, warriorsReturned: 0, tilesDiscovered: 0,
      });
      const entries = getEntries();
      expect(entries.some((e) => e.includes('ENEMY NEST DOES NOT RETURN'))).toBe(true);
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
      expect(msg).toContain('BARRACKS STANDS');
    });

    it('logs upgrade message for level > 1', () => {
      bus.emit('building_complete', { building: 'barracks', level: 3 });
      const msg = getLatestEntry();
      expect(msg).toContain('BARRACKS REACHES LEVEL 3');
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
      expect(msg).toContain('SCOUTS RETURN FROM MARS');
      expect(msg).toContain('5 VOID CRYSTALS');
      expect(msg).toContain('2 ANTIMATTER');
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
      expect(msg).toContain('SCOUTS RETURN FROM VENUS');
      expect(msg).toContain('3 DARK MATTER');
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
      expect(msg).toContain('SCOUTS RETURN FROM JUPITER');
      expect(msg).toContain('WITH NOTHING');
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
      expect(msg).toContain('7 ANTIMATTER');
      expect(msg).not.toContain('VOID CRYSTALS');
      expect(msg).not.toContain('DARK MATTER');
    });
  });

  // ── Probe launch ──
  describe('probe_launch', () => {
    it('logs probe launch with destination', () => {
      bus.emit('probe_launch', { destination: 'Alpha Centauri' });
      const msg = getLatestEntry();
      expect(msg).toContain('A PROBE LEAVES FOR ALPHA CENTAURI');
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
      bus.emit('phase_committed', { from: Phase.EGG_LAYING, to: Phase.COLONY });
      bus.emit('phase_committed', { from: Phase.EGG_LAYING, to: Phase.COLONY }); // second should be ignored
      const entries = getEntries();
      const colonyEntries = entries.filter((e) => e.endsWith(COLONY_LINES.phase_colony.text));
      expect(colonyEntries.length).toBe(1);
    });
  });

  // ── Worker milestones (unchanged) ──
  describe('worker milestones', () => {
    it('fires tenth worker milestone once', () => {
      log.notifyWorkerCount(10);
      log.notifyWorkerCount(50); // should not fire again
      const entries = getEntries();
      const humEntries = entries.filter((e) => e.endsWith(COLONY_LINES.tenth_worker.text));
      expect(humEntries.length).toBe(1);
    });
  });

  // ── Destroy cleanup ──
  describe('destroy — cleanup', () => {
    it('unsubscribes all handlers so no events leak after destroy', () => {
      const before = getEntries().length;
      log.destroy();
      bus.emit('probe_launch', { destination: 'X' });
      bus.emit('exploration_return', {
        destination: 'X', result: 'success',
        voidCrystals: 1, antimatter: 0, darkMatter: 0,
      });
      bus.emit('narrative', { message: 'should not appear' });
      const after = getEntries().length;
      expect(after).toBe(before);
    });
  });

  // ── NEST event lines (Story 1.22, UX-DR30) ──
  describe('NEST event lines', () => {
    const lines = () => Array.from(log.getElement().querySelectorAll<HTMLElement>('.log-entry'));

    it('shows only the newest 3 lines, newest first', () => {
      for (let i = 0; i < 5; i++) {
        bus.emit('building_complete', { building: 'nest', level: i + 2 });
      }
      expect(lines()).toHaveLength(3);
      expect(lines()[0].textContent).toContain('LEVEL 6');
      expect(lines()[1].textContent).toContain('LEVEL 5');
      expect(lines()[2].textContent).toContain('LEVEL 4');
    });

    it('prefixes the newest line with "> " and older ones with "· "', () => {
      bus.emit('building_complete', { building: 'nest', level: 2 });
      bus.emit('building_complete', { building: 'nest', level: 3 });
      const [newest, ...older] = lines();
      expect(newest.dataset.newest).toBe('true');
      expect(newest.querySelector('[data-line-prefix]')?.textContent).toBe('> ');
      for (const line of older) {
        expect(line.dataset.newest).toBe('false');
        expect(line.querySelector('[data-line-prefix]')?.textContent).toBe('· ');
      }
    });

    it('keeps the phase line newest over the panel reveals of the same commit', () => {
      bus.emit('phase_committed', { from: Phase.EXPANSION, to: Phase.SPACE });
      bus.emit('panel_revealed', { panelId: 'spaceship_panel' });
      bus.emit('panel_revealed', { panelId: 'expedition_panel' });
      bus.emit('panel_revealed', { panelId: 'soldier_panel' });
      expect(lines()[0].textContent).toBe('> ' + COLONY_LINES.phase_space.text);
      expect(log.entries()).toHaveLength(5);
    });

    it('a later panel reveal is newest again', async () => {
      bus.emit('phase_committed', { from: Phase.EXPANSION, to: Phase.SPACE });
      await Promise.resolve();
      bus.emit('panel_revealed', { panelId: 'spaceship_panel' });
      expect(lines()[0].textContent).toBe('> ' + COLONY_LINES.panel_spaceship.text);
    });

    it('keeps older entries in memory for the LOG tab', () => {
      for (let i = 0; i < 5; i++) {
        bus.emit('building_complete', { building: 'nest', level: i + 2 });
      }
      expect(log.entries().length).toBeGreaterThan(lines().length);
    });
  });
});
