import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase } from '../../../src/phases/phases';
import { digBalance } from '../../../src/data/balance/dig';
import { roomJobBalance } from '../../../src/data/balance/roomJobs';
import { ROOM_JOBS } from '../../../src/data/content/roomJobs';
import { addDigPoints, roomCost } from '../../../src/systems/Dig';
import { applyRoomJob, plainRooms, roomJobCost, roomJobRefusal, ROOM_JOB_IDS, type RoomSlot } from '../../../src/systems/RoomJobs';
import { roomSpace } from '../../../src/systems/Crowding';
import { prestige } from '../../../src/systems/PrestigeSystem';
import { migrateSave } from '../../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../../src/persistence/SaveManager';
import { EventBus } from '../../../src/engine/EventBus';
import { testActions } from '../helpers/actions';
import { makeState } from '../helpers/makeState';
import { defaultPolicy } from '../../../src/sim/policy';

/**
 * Story 9.14 (FR59, FR63): a room can take a job. Room jobs are counts by job
 * (`roomJobs.jobs`), never more in total than the rooms dug; `roomJobs.fresh`
 * counts the plain rooms never assigned (their first job is free). A Gallery
 * room holds a room's worth more ants.
 */

const totalJobs = (s: GameState) => ROOM_JOB_IDS.reduce((n, id) => n + s.roomJobs.jobs[id], 0);

/** A Colony nest with `rooms` rooms dug, `fresh` of them never assigned, and stone to spare. */
function nest(rooms: number, fresh = rooms, gallery = 0, workers = 0): GameState {
  const s = createInitialState();
  return {
    ...s,
    phase: Phase.COLONY,
    dig: { ...s.dig, roomsDug: rooms },
    roomJobs: { jobs: { ...s.roomJobs.jobs, gallery }, fresh },
    resources: {
      ...s.resources,
      workers,
      stone: 1_000_000,
      nestCapacity: s.resources.nestCapacity + rooms * digBalance.roomSize + gallery * digBalance.roomSize,
    },
  };
}

describe('Story 9.14: room jobs as data', () => {
  it('offers Gallery, each job with copy and a capacity effect from data', () => {
    expect(ROOM_JOB_IDS).toContain('gallery');
    for (const id of ROOM_JOB_IDS) {
      expect(ROOM_JOBS.find((j) => j.id === id)?.label).toBeTruthy();
      expect(roomJobBalance.jobs[id]).toBeDefined();
    }
  });

  it('starts a run with no jobs and no rooms', () => {
    const s = createInitialState();
    expect(totalJobs(s)).toBe(0);
    expect(s.roomJobs.fresh).toBe(0);
  });
});

describe('Story 9.14: rooms opened are plain and fresh', () => {
  it('every room dug opens plain and never assigned', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 1, max: 5 }), (dug, more) => {
        const s = nest(dug);
        let points = 0;
        for (let i = 0; i < more; i++) points += roomCost(dug + i);
        const after = addDigPoints(s, points);
        expect(after.dig.roomsDug).toBe(dug + more);
        expect(after.roomJobs.fresh).toBe(s.roomJobs.fresh + more);
        expect(totalJobs(after)).toBe(totalJobs(s));
      }),
    );
  });
});

describe('Story 9.14: setting a job', () => {
  const slots: RoomSlot[] = ['plain', ...ROOM_JOB_IDS];
  const arb = fc.record({
    rooms: fc.integer({ min: 0, max: 40 }),
    freshShare: fc.double({ min: 0, max: 1, noNaN: true }),
    galleryShare: fc.double({ min: 0, max: 1, noNaN: true }),
    // Workers up to past the room space (a crowded nest), and stone from none to plenty.
    fill: fc.double({ min: 0, max: 1.5, noNaN: true }),
    stone: fc.constantFrom(0, roomJobBalance.changeCostStone - 1, roomJobBalance.changeCostStone, 1_000_000),
    from: fc.constantFrom(...slots),
    to: fc.constantFrom(...slots),
  }).map(({ rooms, freshShare, galleryShare, fill, stone, from, to }) => {
    const gallery = Math.floor(rooms * galleryShare);
    const fresh = Math.floor((rooms - gallery) * freshShare);
    const s = nest(rooms, fresh, gallery);
    return { s: { ...s, resources: { ...s.resources, stone, workers: Math.floor(roomSpace(s) * fill) } }, from, to };
  });

  it('never has more jobs than rooms, never a negative count, and the fresh rooms are plain', () => {
    fc.assert(
      fc.property(arb, ({ s, from, to }) => {
        const after = applyRoomJob(s, from, to);
        expect(totalJobs(after)).toBeLessThanOrEqual(after.dig.roomsDug);
        for (const id of ROOM_JOB_IDS) expect(after.roomJobs.jobs[id]).toBeGreaterThanOrEqual(0);
        expect(after.roomJobs.fresh).toBeGreaterThanOrEqual(0);
        expect(after.roomJobs.fresh).toBeLessThanOrEqual(plainRooms(after));
        expect(Number.isInteger(after.resources.stone)).toBe(true);
      }),
    );
  });

  it('a Gallery room adds exactly one more room’s worth of space; capacity never falls when a room gets a job', () => {
    fc.assert(
      fc.property(arb, ({ s, from, to }) => {
        if (roomJobRefusal(s, from, to) !== null) return;
        const after = applyRoomJob(s, from, to);
        const delta = roomSpace(after) - roomSpace(s);
        const rooms = (slot: RoomSlot) => (slot === 'plain' ? 0 : roomJobBalance.jobs[slot].extraRooms);
        expect(delta).toBe((rooms(to) - rooms(from)) * digBalance.roomSize);
        if (from === 'plain') expect(delta).toBeGreaterThanOrEqual(0);
        if (from === 'plain' && to === 'gallery') expect(delta).toBe(digBalance.roomSize);
      }),
    );
  });

  it('the first job on a never-assigned room is free; a change after that costs stone', () => {
    const fresh = nest(3, 3);
    expect(roomJobCost(fresh, 'plain', 'gallery').stone).toBe(0);
    const once = applyRoomJob(fresh, 'plain', 'gallery');
    expect(once.resources.stone).toBe(fresh.resources.stone);
    expect(roomJobCost(once, 'gallery', 'plain').stone).toBeGreaterThan(0);
    const back = applyRoomJob(once, 'gallery', 'plain');
    expect(back.resources.stone).toBe(once.resources.stone - roomJobCost(once, 'gallery', 'plain').stone);
    // Every room assigned once: the next plain → job costs stone too.
    const used = nest(2, 0);
    expect(roomJobCost(used, 'plain', 'gallery').stone).toBeGreaterThan(0);
  });

  it('never refuses a change that adds room for lack of room, however crowded', () => {
    fc.assert(
      fc.property(arb, ({ s, from, to }) => {
        const rooms = (slot: RoomSlot) => (slot === 'plain' ? 0 : roomJobBalance.jobs[slot].extraRooms);
        if (rooms(to) >= rooms(from)) expect(roomJobRefusal(s, from, to)).not.toBe('at_capacity');
        // A change that takes room away is allowed only while every worker still has one.
        if (rooms(to) < rooms(from) && roomJobRefusal(s, from, to) === null) expect(s.resources.workers).toBeLessThanOrEqual(roomSpace(applyRoomJob(s, from, to)));
      }),
    );
  });

  it('refuses what it can’t do, and explains it', () => {
    expect(roomJobRefusal(nest(0), 'plain', 'gallery')).toBe('unavailable');
    expect(roomJobRefusal(nest(2, 0, 0), 'gallery', 'plain')).toBe('unavailable');
    expect(roomJobRefusal(nest(2), 'plain', 'plain')).toBe('unavailable');
    const broke = { ...nest(2, 0), resources: { ...nest(2, 0).resources, stone: 0 } };
    expect(roomJobRefusal(broke, 'plain', 'gallery')).toBe('cannot_afford');
    // Taking a Gallery's room away would leave workers with no room.
    const full = nest(2, 0, 1);
    const packed = { ...full, resources: { ...full.resources, workers: roomSpace(full) } };
    expect(roomJobRefusal(packed, 'gallery', 'plain')).toBe('at_capacity');
    expect(roomJobRefusal({ ...nest(2), phase: Phase.EGG_LAYING }, 'plain', 'gallery')).toBe('locked');
  });
});

describe('Story 9.14: the setRoomJob action', () => {
  it('changes the job in one write, or refuses and leaves the state as it was', () => {
    let s = nest(2, 1);
    const actions = testActions(new EventBus(), () => s, (n) => (s = n));
    const before = s;
    expect(actions.setRoomJob('gallery', 'plain')).toEqual({ ok: false, reason: 'unavailable' });
    expect(s).toBe(before);
    expect(actions.setRoomJob('plain', 'gallery').ok).toBe(true);
    expect(s.roomJobs.jobs.gallery).toBe(1);
    expect(s.roomJobs.fresh).toBe(0);
  });
});

describe('Story 9.14: saves and prestige', () => {
  afterEach(() => localStorage.clear());

  it('a save from before room jobs loads with no jobs, every dug room fresh', () => {
    const v = SaveManager.SAVE_VERSION;
    const s = structuredClone(createInitialState()) as unknown as Record<string, unknown>;
    delete s.roomJobs;
    const old: SaveData = {
      version: v - 1,
      timestamp: 1,
      playTimeMs: 0,
      gameState: { ...s, dig: { ...(s.dig as object), roomsDug: 7 } } as unknown as GameState,
    };
    const gs = migrateSave(old, v - 1, v).gameState;
    expect(totalJobs(gs)).toBe(0);
    expect(gs.roomJobs.fresh).toBe(7);
  });

  it('prestige resets the room jobs with the run', () => {
    const s = makeState({ phase: Phase.COMBAT, roomJobs: { jobs: { gallery: 4 }, fresh: 2 } });
    const after = prestige(s);
    expect(totalJobs(after)).toBe(0);
    expect(after.roomJobs.fresh).toBe(0);
  });
});

describe('Story 9.14: only a DIG press offers the choice', () => {
  it('a press that opens a room says so; the diggers’ own rooms open quietly', () => {
    const bus = new EventBus();
    const seen: { byPress?: boolean }[] = [];
    bus.subscribe('room_opened', (e) => seen.push(e));
    const base = nest(0);
    let s: GameState = { ...base, dig: { ...base.dig, progress: roomCost(0) - 1 } };
    const actions = testActions(bus, () => s, (n) => (s = n));
    expect(actions.dig().ok).toBe(true);
    expect(seen).toEqual([{ roomsDug: 1, byPress: true }]);
  });
});

describe('Story 9.14: the simulated player picks a job through the same intent', () => {
  const crowd = (s: GameState, brood: number): GameState => ({ ...s, resources: { ...s.resources, eggs: brood }, eggPipeline: { count: brood, progress: 0 } });

  it('gives a fresh room the Gallery when crowded, and leaves it plain otherwise', () => {
    const roomy = nest(2, 1);
    const crowded = crowd(roomy, roomSpace(roomy) * 3);
    const pick = { kind: 'setRoomJob', from: 'plain', to: 'gallery' };
    expect(defaultPolicy(crowded, { taps: 0 })).toContainEqual(pick);
    expect(defaultPolicy(roomy, { taps: 0 })).not.toContainEqual(pick);
    expect(defaultPolicy(crowd(nest(2, 0), roomSpace(roomy) * 3), { taps: 0 })).not.toContainEqual(pick);
  });
});
