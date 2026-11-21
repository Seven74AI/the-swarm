import { afterEach, describe, expect, it } from 'vitest';
import { signal } from '@preact/signals-core';
import { EventLog } from '../../../../src/ui/log/EventLog';
import { EventBus } from '../../../../src/engine/EventBus';
import { createChronicle, type Chronicle } from '../../../../src/state/chronicle';
import { Phase, PHASE_ORDER } from '../../../../src/phases/phases';
import { MVP_PHASES, NARRATIVE_BEATS } from '../../../../src/data/content/narrative';
import { EVENT_SAMPLES } from '../../helpers/eventSamples';

/** Story 4.9 (FR19): the entry beat is written on commit, the near-goal beat once per run. */
describe('story beats in the chronicle (Story 4.9)', () => {
  const messages = (c: Chronicle) => c.entries.value.map((e) => e.message);
  const count = (c: Chronicle, text: string) => messages(c).filter((m) => m === text).length;
  const logs: EventLog[] = [];
  afterEach(() => {
    for (const l of logs.splice(0)) l.destroy();
  });
  const open = (bus: EventBus, chronicle: Chronicle, nearGoal = signal<string | null>(null)) => {
    logs.push(new EventLog(bus, { chronicle, nearGoal }));
    return nearGoal;
  };

  it('a new chronicle opens with the first phase entry beat', () => {
    const c = createChronicle();
    open(new EventBus(), c);
    expect(messages(c)).toEqual([NARRATIVE_BEATS[Phase.EGG_LAYING].entry.text]);
  });

  it('committing an MVP phase writes its entry beat, once, as the newest line', () => {
    for (const to of MVP_PHASES.slice(1)) {
      const c = createChronicle();
      const bus = new EventBus();
      open(bus, c);
      const from = PHASE_ORDER[PHASE_ORDER.indexOf(to) - 1];
      bus.emit('phase_committed', { from, to });
      expect(messages(c)[0]).toBe(NARRATIVE_BEATS[to].entry.text);
      bus.emit('phase_committed', { from, to });
      expect(count(c, NARRATIVE_BEATS[to].entry.text)).toBe(1);
    }
  });

  it('the entry beat stays on top of the panel lines its commit reveals', () => {
    const c = createChronicle();
    const bus = new EventBus();
    open(bus, c);
    bus.emit('phase_committed', { from: Phase.EGG_LAYING, to: Phase.COLONY });
    bus.emit('panel_revealed', { panelId: 'building_panel' });
    expect(messages(c)[0]).toBe(NARRATIVE_BEATS[Phase.COLONY].entry.text);
    expect(messages(c).length).toBeGreaterThan(2);
  });

  it('a commit writes one line of its own, not several', () => {
    const c = createChronicle();
    const bus = new EventBus();
    open(bus, c);
    const before = messages(c).length;
    bus.emit('phase_committed', { from: Phase.COLONY, to: Phase.COMBAT });
    expect(messages(c).length).toBe(before + 1);
  });

  it('writes the near-goal beat when the goal first comes near, once per run', () => {
    const c = createChronicle();
    const near = open(new EventBus(), c);
    const beat = NARRATIVE_BEATS[Phase.EGG_LAYING].nearGoal.text;
    expect(count(c, beat)).toBe(0);
    near.value = Phase.EGG_LAYING;
    expect(messages(c)[0]).toBe(beat);
    // The progress dips and comes back: no repeat.
    near.value = null;
    near.value = Phase.EGG_LAYING;
    expect(count(c, beat)).toBe(1);
  });

  it('each MVP phase has its own near-goal beat', () => {
    const c = createChronicle();
    const near = open(new EventBus(), c);
    for (const p of MVP_PHASES) near.value = p;
    for (const p of MVP_PHASES) expect(count(c, NARRATIVE_BEATS[p].nearGoal.text)).toBe(1);
  });

  it('a reload never repeats the near-goal beat (it is a chronicle milestone, kept in the save)', () => {
    const c1 = createChronicle();
    open(new EventBus(), c1, signal<string | null>(Phase.COLONY));
    const beat = NARRATIVE_BEATS[Phase.COLONY].nearGoal.text;
    expect(count(c1, beat)).toBe(1);

    const c2 = createChronicle(JSON.parse(JSON.stringify(c1.snapshot())));
    open(new EventBus(), c2, signal<string | null>(Phase.COLONY));
    expect(count(c2, beat)).toBe(1);
  });

  it('a prestige starts a new run, so the beats can be written again', () => {
    const c = createChronicle();
    const bus = new EventBus();
    const near = open(bus, c);
    near.value = Phase.EGG_LAYING;
    near.value = null;
    bus.emit('prestige_triggered', EVENT_SAMPLES.prestige_triggered);
    near.value = Phase.EGG_LAYING;
    expect(count(c, NARRATIVE_BEATS[Phase.EGG_LAYING].nearGoal.text)).toBe(1);
  });

  it('later phases have no near-goal beat', () => {
    const c = createChronicle();
    const near = open(new EventBus(), c);
    const before = messages(c).length;
    for (const p of PHASE_ORDER.slice(MVP_PHASES.length)) near.value = p;
    expect(messages(c).length).toBe(before);
  });

  it('stops listening once destroyed', () => {
    const c = createChronicle();
    const near = signal<string | null>(null);
    const log = new EventLog(new EventBus(), { chronicle: c, nearGoal: near });
    log.destroy();
    near.value = Phase.EGG_LAYING;
    expect(count(c, NARRATIVE_BEATS[Phase.EGG_LAYING].nearGoal.text)).toBe(0);
  });
});
