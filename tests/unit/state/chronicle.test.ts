import { describe, it, expect } from 'vitest';
import { effect } from '@preact/signals-core';
import {
  CHRONICLE_MAX_LINES,
  createChronicle,
  emptyChronicle,
  normalizeChronicle,
} from '../../../src/state/chronicle';

/** Story 1.26 (UX-DR30): the colony's event lines, newest first, kept with the save. */
describe('chronicle', () => {
  it('keeps lines newest first', () => {
    const c = createChronicle();
    c.add('first');
    c.add('second');
    expect(c.entries.value.map((e) => e.message)).toEqual(['second', 'first']);
  });

  it('inserts a line under the newest one when asked', () => {
    const c = createChronicle();
    c.add('old');
    c.add('top');
    c.add('under', { at: 1 });
    expect(c.entries.value.map((e) => e.message)).toEqual(['top', 'under', 'old']);
  });

  it(`keeps only the newest ${CHRONICLE_MAX_LINES} lines`, () => {
    const c = createChronicle();
    for (let i = 0; i < CHRONICLE_MAX_LINES + 5; i++) c.add(`line ${i}`);
    const lines = c.entries.value;
    expect(lines.length).toBe(CHRONICLE_MAX_LINES);
    expect(lines[0].message).toBe(`line ${CHRONICLE_MAX_LINES + 4}`);
    expect(lines.some((e) => e.message === 'line 0')).toBe(false);
  });

  it('stores what a line points at', () => {
    const c = createChronicle();
    c.add('a building rises', { target: 'building_panel' });
    expect(c.entries.value[0].target).toBe('building_panel');
  });

  it('records milestones once', () => {
    const c = createChronicle();
    expect(c.hasMilestone('first_egg')).toBe(false);
    c.markMilestone('first_egg');
    c.markMilestone('first_egg');
    expect(c.hasMilestone('first_egg')).toBe(true);
    expect(c.snapshot().milestones).toEqual(['first_egg']);
  });

  it('round-trips through its snapshot', () => {
    const c = createChronicle();
    c.add('one', { target: 'worker_assignment' });
    c.markMilestone('first_worker');
    const copy = createChronicle(JSON.parse(JSON.stringify(c.snapshot())));
    expect(copy.snapshot()).toEqual(c.snapshot());
  });

  it('reset empties lines and milestones, and notifies readers', () => {
    const c = createChronicle();
    c.add('one');
    c.markMilestone('first_egg');
    let runs = 0;
    const dispose = effect(() => {
      void c.entries.value;
      runs++;
    });
    c.reset();
    dispose();
    expect(runs).toBeGreaterThan(1);
    expect(c.snapshot()).toEqual(emptyChronicle());
  });

  it('load replaces everything with a saved chronicle', () => {
    const c = createChronicle();
    c.add('current');
    c.load({ entries: [{ message: 'saved', timestamp: 1 }], milestones: ['first_egg'] });
    expect(c.entries.value.map((e) => e.message)).toEqual(['saved']);
    expect(c.hasMilestone('first_egg')).toBe(true);
  });

  describe('normalizeChronicle', () => {
    it('turns anything that is not a chronicle into an empty one', () => {
      for (const raw of [undefined, null, 3, 'x', [], { entries: 'no' }]) {
        expect(normalizeChronicle(raw)).toEqual(emptyChronicle());
      }
    });

    it('drops malformed lines and unknown targets, keeps the rest in order', () => {
      const out = normalizeChronicle({
        entries: [
          { message: 'good', timestamp: 2, target: 'map_panel' },
          { message: 5, timestamp: 1 },
          { message: 'no time' },
          { message: 'bad target', timestamp: 1, target: 'nowhere' },
          null,
        ],
        milestones: ['first_egg', 7],
      });
      expect(out.entries).toEqual([
        { message: 'good', timestamp: 2, target: 'map_panel' },
        { message: 'no time', timestamp: 0 },
        { message: 'bad target', timestamp: 1 },
      ]);
      expect(out.milestones).toEqual(['first_egg']);
    });

    it(`caps a saved chronicle at ${CHRONICLE_MAX_LINES} lines, keeping the newest`, () => {
      const entries = Array.from({ length: CHRONICLE_MAX_LINES + 10 }, (_, i) => ({ message: `l${i}`, timestamp: i }));
      const out = normalizeChronicle({ entries, milestones: [] });
      expect(out.entries.length).toBe(CHRONICLE_MAX_LINES);
      expect(out.entries[0].message).toBe('l0');
    });
  });
});
