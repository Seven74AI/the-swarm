import { describe, it, expect } from 'vitest';
import { EventLog } from '../../../../src/ui/panels/EventLog';
import { EventBus } from '../../../../src/engine/EventBus';
import { createChronicle } from '../../../../src/state/chronicle';

/** Story 1.26 (UX-DR30): the event lines are written into the chronicle, which the save keeps. */
describe('EventLog writes the chronicle', () => {
  const messages = (c: ReturnType<typeof createChronicle>) => c.entries.value.map((e) => e.message);

  it('opens a new chronicle with one line, and never repeats it over a saved one', () => {
    const fresh = createChronicle();
    new EventLog(new EventBus(), { chronicle: fresh });
    expect(fresh.entries.value.length).toBe(1);

    const saved = createChronicle({ entries: [{ message: 'from the save', timestamp: 1 }], milestones: [] });
    new EventLog(new EventBus(), { chronicle: saved });
    expect(messages(saved)).toEqual(['from the save']);
  });

  it('adds every line to the chronicle, newest first', () => {
    const c = createChronicle();
    const bus = new EventBus();
    new EventLog(bus, { chronicle: c });
    bus.emit('narrative', { message: 'one' });
    bus.emit('narrative', { message: 'two' });
    expect(messages(c).slice(0, 2)).toEqual(['two', 'one']);
  });

  it('draws NEST lines from the chronicle, including a loaded one', () => {
    const c = createChronicle();
    const log = new EventLog(new EventBus(), { chronicle: c });
    c.load({ entries: [{ message: 'loaded line', timestamp: 1 }], milestones: [] });
    expect(log.getElement().querySelector('.log-entry')?.textContent).toContain('loaded line');
  });

  it('remembers one-time lines through the save, so a reload never repeats them', () => {
    const bus1 = new EventBus();
    const c1 = createChronicle();
    new EventLog(bus1, { chronicle: c1 });
    bus1.emit('egg_clicked', { eggs: 1 } as never);
    const firstEggLines = c1.entries.value.length;

    const c2 = createChronicle(JSON.parse(JSON.stringify(c1.snapshot())));
    const bus2 = new EventBus();
    new EventLog(bus2, { chronicle: c2 });
    bus2.emit('egg_clicked', { eggs: 1 } as never);
    expect(c2.entries.value.length).toBe(firstEggLines);
  });

  it('points lines at what they are about', () => {
    const c = createChronicle();
    const bus = new EventBus();
    new EventLog(bus, { chronicle: c });
    bus.emit('building_complete', { building: 'barracks', level: 1 } as never);
    expect(c.entries.value[0].target).toBe('building_panel');
  });

  it('a prestige starts a new chronicle: old lines go, one line opens the new run, one-time lines fire again', () => {
    const c = createChronicle();
    const bus = new EventBus();
    new EventLog(bus, { chronicle: c });
    bus.emit('egg_clicked', { eggs: 1 } as never);
    bus.emit('narrative', { message: 'old run' });
    bus.emit('prestige_triggered', { fromCount: 0, toCount: 1, legacyPointsGained: 1, totalLegacyPoints: 1 });
    expect(messages(c)).not.toContain('old run');
    expect(c.entries.value.length).toBe(1);
    const before = c.entries.value.length;
    bus.emit('egg_clicked', { eggs: 1 } as never);
    expect(c.entries.value.length).toBeGreaterThan(before);
  });

  it('a NEST line that points somewhere jumps there when tapped', () => {
    const c = createChronicle();
    const bus = new EventBus();
    const jumps: string[] = [];
    const log = new EventLog(bus, { chronicle: c, jump: { canJump: () => true, jump: (id) => jumps.push(id) } });
    bus.emit('building_complete', { building: 'walls', level: 2 } as never);
    const btn = log.getElement().querySelector<HTMLElement>('.log-entry [data-jump]');
    expect(btn?.dataset.jump).toBe('building_panel');
    btn!.click();
    expect(jumps).toEqual(['building_panel']);
  });
});
