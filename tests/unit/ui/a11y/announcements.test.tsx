import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { EventBus } from '../../../../src/engine/EventBus';
import { Phase } from '../../../../src/phases/phases';
import { createAnnouncer, ANNOUNCER_LINES, type Announcer } from '../../../../src/ui/shell/announcer';
import { LiveRegion } from '../../../../src/ui/shell/LiveRegion';
import { bindAnnouncements, battleLine, ANNOUNCE_COOLDOWN_MS } from '../../../../src/ui/shell/announcements';
import { PHASE_TITLES } from '../../../../src/ui/shell/GoalMeter';
import { DECISIONS } from '../../../../src/data/content/decisions';
import type { BattleResult } from '../../../../src/systems/BattleSystem';

/**
 * Story 1.32 (UX-DR40): polite live regions announce the key changes, once
 * each, and never resource values per tick.
 */

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function setup() {
  const bus = new EventBus();
  const announcer = createAnnouncer();
  const goalMet = signal(false);
  const starving = signal(false);
  const capacityReached = signal(false);
  let clock = 1_000_000;
  const said: string[] = [];
  const stopSpy = announcerSpy(announcer, said);
  const unbind = bindAnnouncements({ bus, announcer, goalMet, starving, capacityReached, now: () => clock });
  return {
    bus,
    announcer,
    goalMet,
    starving,
    capacityReached,
    said,
    advance: (ms: number) => (clock += ms),
    stop: () => {
      unbind();
      stopSpy();
    },
  };
}

/** Every announcement made, in order. */
function announcerSpy(a: Announcer, out: string[]): () => void {
  let last = a.current.peek()?.id;
  return a.current.subscribe((v) => {
    if (v && v.id !== last) out.push(v.text);
    last = v?.id;
  });
}

describe('LiveRegion', () => {
  it('is one polite status region that exists before anything is said', () => {
    const announcer = createAnnouncer();
    render(<LiveRegion announcer={announcer} />);
    const region = document.querySelector<HTMLElement>('[data-announcer]')!;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
    act(() => announcer.announce('Nest capacity reached.'));
    expect(region.textContent).toBe('Nest capacity reached.');
  });

  it('two lines said at once are both in the region, and old lines drop off', () => {
    const announcer = createAnnouncer();
    render(<LiveRegion announcer={announcer} />);
    act(() => {
      announcer.announce('Phase entered: Colony.');
      announcer.announce('Goal met.');
    });
    const region = document.querySelector<HTMLElement>('[data-announcer]')!;
    expect(region.textContent).toContain('Phase entered');
    expect(region.textContent).toContain('Goal met');
    act(() => {
      for (let i = 0; i < 10; i++) announcer.announce(`line ${i}`);
    });
    expect(region.children.length).toBeLessThanOrEqual(ANNOUNCER_LINES);
  });

  it('says the same line again when it is announced again', () => {
    const announcer = createAnnouncer();
    render(<LiveRegion announcer={announcer} />);
    act(() => announcer.announce('Goal met.'));
    const first = document.querySelector('[data-announcer] > *');
    act(() => announcer.announce('Goal met.'));
    expect(document.querySelector('[data-announcer] > *:last-child')).not.toBe(first);
  });
});

describe('bindAnnouncements', () => {
  it('announces the goal being met once, when it becomes met', () => {
    const t = setup();
    t.goalMet.value = true;
    t.goalMet.value = true;
    expect(t.said).toHaveLength(1);
    expect(t.said[0]).toMatch(/goal met/i);
    t.stop();
  });

  it('announces the phase entered by name', () => {
    const t = setup();
    t.bus.emit('phase_committed', { from: Phase.EGG_LAYING, to: Phase.COLONY });
    expect(t.said.at(-1)).toContain(PHASE_TITLES[Phase.COLONY]);
    t.stop();
  });

  it('announces a decision by its title when it arrives', () => {
    const t = setup();
    const def = DECISIONS[0];
    t.bus.emit('decision_spawned', { id: def.id });
    expect(t.said.at(-1)).toContain(def.title);
    t.stop();
  });

  it('announces starving and capacity reached on the edge, not while they last', () => {
    const t = setup();
    t.starving.value = true;
    t.capacityReached.value = true;
    expect(t.said.filter((s) => /starv/i.test(s))).toHaveLength(1);
    expect(t.said.filter((s) => /capacity/i.test(s))).toHaveLength(1);
    t.stop();
  });

  it('a condition flickering at its edge is not announced again within the cooldown', () => {
    const t = setup();
    t.starving.value = true;
    t.starving.value = false;
    t.starving.value = true;
    expect(t.said.filter((s) => /starv/i.test(s))).toHaveLength(1);
    t.advance(ANNOUNCE_COOLDOWN_MS + 1);
    t.starving.value = false;
    t.starving.value = true;
    expect(t.said.filter((s) => /starv/i.test(s))).toHaveLength(2);
    t.stop();
  });

  it('a state already true when it binds is not announced (no noise at boot)', () => {
    const bus = new EventBus();
    const announcer = createAnnouncer();
    const said: string[] = [];
    const stop = announcerSpy(announcer, said);
    bindAnnouncements({ bus, announcer, goalMet: signal(true), starving: signal(true), capacityReached: signal(true) });
    expect(said).toEqual([]);
    stop();
  });

  it('resource changes are never announced: a stream of ticks says nothing', () => {
    const t = setup();
    for (let i = 0; i < 200; i++) {
      t.bus.emit('food_changed', { food: i });
      t.bus.emit('workers_changed', { workers: i });
      t.bus.emit('eggs_changed', { eggs: i });
    }
    expect(t.said).toEqual([]);
    t.stop();
  });
});

describe('battleLine', () => {
  it('names the outcome and the enemy, in words', () => {
    const r = { outcome: 'victory', soldiersLost: 2 } as BattleResult;
    expect(battleLine(r, 'Red Ant')).toMatch(/won/i);
    expect(battleLine({ ...r, outcome: 'defeat' }, 'Red Ant')).toMatch(/lost/i);
    expect(battleLine({ ...r, outcome: 'draw' }, 'Red Ant')).toMatch(/draw/i);
    expect(battleLine(r, 'Red Ant')).toContain('Red Ant');
  });
});
