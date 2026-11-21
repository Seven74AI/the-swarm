import { afterEach, describe, expect, it, vi } from 'vitest';
import { catchUp, type CatchUpDeps } from '../../../src/engine/catchUp';
import { processTick } from '../../../src/engine/processTick';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { TICK_MS } from '../../../src/data/constants';
import type { GameState } from '../../../src/state/GameState';
import { createWebNotifications, type Notifications } from '../../../src/platform/notifications';
import { makeState } from '../helpers/makeState';

/**
 * Story 2.14 (FR26): no game outcome depends on notifications. The same state
 * runs through the live tick and the offline catch-up with no notification
 * service at all, and with the browser's notification APIs present and the
 * platform service being driven between ticks: the results are identical.
 */

/** A seeded stand-in for Math.random (mulberry32), so both runs draw the same numbers. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deps(): CatchUpDeps {
  const bus = new EventBus();
  const fsm = new PhaseStateMachine(TRANSITIONS);
  return {
    resourceSystem: new ResourceSystem(bus),
    soldierSystem: new SoldierSystem(bus),
    mapSystem: new MapSystem(),
    territorySystem: new TerritorySystem(),
    latch: (s) => fsm.latch(s),
  };
}

const START = (): GameState =>
  makeState({
    phase: 'combat',
    resources: { workers: 40, food: 500, eggs: 20 },
    eggPipeline: { count: 20, progress: 0 },
    workersAssigned: { gather: 20, tend: 5, dig: 5 },
  });

/** 200 live ticks, then 10 minutes of catch-up; `between` runs after every tick. */
function play(between: () => void): { live: GameState; offline: GameState; events: string[] } {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(2_14));
  const d = deps();
  const queue = new EventQueue();
  let s = START();
  for (let i = 0; i < 200; i++) {
    s = processTick(s, d.resourceSystem, d.soldierSystem, d.mapSystem, d.territorySystem, queue, TICK_MS / 1000);
    between();
  }
  const events: string[] = [];
  queue.flushTo({ emit: (type) => void events.push(type) });
  const offline = catchUp(s, 600_000, 12_000, d);
  vi.restoreAllMocks();
  return { live: s, offline, events };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('notifications never change a game outcome (Story 2.14)', () => {
  it('gives the same state with or without a notification service', () => {
    vi.stubGlobal('Notification', undefined);
    const without = play(() => {});
    vi.unstubAllGlobals();

    const requestPermission = vi.fn(async () => 'granted');
    const showNotification = vi.fn();
    vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission: 'granted', requestPermission }));
    const service: Notifications = createWebNotifications();
    let n = 0;
    const withService = play(() => {
      n++;
      service.schedule({ id: `tick-${n}`, atMs: Date.now() + n, title: 'THE SWARM', body: 'TICK.' });
      if (n % 7 === 0) service.cancel(`tick-${n - 1}`);
      if (n % 50 === 0) service.cancelAll();
    });

    expect(withService.live).toEqual(without.live);
    expect(withService.offline).toEqual(without.offline);
    expect(withService.events).toEqual(without.events);
    // The run did something, so the comparison means something.
    expect(without.offline.stats.playTimeMs).toBeGreaterThan(START().stats.playTimeMs);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });
});
