/**
 * Story 9.2 (FR55, FR3, FR5): DIG digs the next room a chunk at a time.
 * Invariants only: every number comes from `digBalance` / the dig helpers.
 */
import { describe, expect, it } from 'vitest';
import { digBalance } from '../../../src/data/balance/dig';
import { diggerPointsPerSec, digPoints, digPress, pressChunk, roomCost } from '../../../src/systems/Dig';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { EventBus } from '../../../src/engine/EventBus';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';
import { testActions } from '../helpers/actions';
import { gameState } from '../../../src/state/gameSignal';
import type { GameState } from '../../../src/state/GameState';

const colony = (dig = 0, over: Parameters<typeof makeState>[0] = {}) =>
  // Room to spare: crowding (Story 9.13) is tested on its own.
  makeState({ phase: Phase.COLONY, resources: { workers: Math.max(dig, 1), nestCapacity: 10_000 }, workersAssigned: { dig }, ...over });

describe('room cost', () => {
  it('rises strictly with every room dug', () => {
    for (let n = 0; n < 200; n++) {
      expect(Number.isInteger(roomCost(n))).toBe(true);
      expect(roomCost(n + 1)).toBeGreaterThan(roomCost(n));
    }
  });

  it('a room holds more than one ant', () => {
    expect(digBalance.roomSize).toBeGreaterThan(1);
  });
});

describe('a DIG press', () => {
  it('adds a whole chunk, bigger with every digger', () => {
    const a = pressChunk(colony(0));
    const b = pressChunk(colony(Math.ceil(1 / digBalance.pressPointsPerDigger)));
    for (let d = 0; d < 50; d++) expect(pressChunk(colony(d + 1))).toBeGreaterThanOrEqual(pressChunk(colony(d)));
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    const s = colony(0);
    expect(digPress(s).dig.progress).toBe(s.dig.progress + a);
  });

  it('brings in stone for the dirt dug, as whole stone', () => {
    let s = colony(5);
    const stone = s.resources.stone;
    for (let i = 0; i < 50; i++) {
      s = digPress(s);
      expect(Number.isInteger(s.resources.stone)).toBe(true);
    }
    expect(s.resources.stone).toBeGreaterThan(stone);
  });

  it('opens the room once the progress reaches its cost: capacity grows by a room, progress carries over', () => {
    const s0 = colony(0);
    const cost = roomCost(s0.dig.roomsDug);
    const s = { ...s0, dig: { ...s0.dig, progress: cost - 1 } };
    const after = digPress(s);
    expect(after.dig.roomsDug).toBe(s.dig.roomsDug + 1);
    expect(after.resources.nestCapacity).toBe(s.resources.nestCapacity + digBalance.roomSize);
    expect(after.dig.progress).toBe(cost - 1 + pressChunk(s) - cost);
  });

  it('the next room costs more presses than this one', () => {
    let s = colony(0);
    const pressesFor = () => {
      const rooms = s.dig.roomsDug;
      let n = 0;
      while (s.dig.roomsDug === rooms) {
        s = digPress(s);
        n++;
      }
      return n;
    };
    pressesFor();
    const second = pressesFor();
    const third = pressesFor();
    expect(third).toBeGreaterThanOrEqual(second);
    expect(roomCost(2)).toBeGreaterThan(roomCost(1));
  });

  it('never writes the state it was given', () => {
    const s = colony(2);
    const copy = structuredClone(s);
    digPress(s);
    expect(s).toEqual(copy);
  });
});

describe('the dig action', () => {
  it('is refused in Egg Laying and leaves the state', () => {
    const actions = testActions();
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    const before = gameState.value;
    expect(actions.dig().ok).toBe(false);
    expect(gameState.value).toBe(before);
  });

  it('from Colony on, adds the chunk in one write', () => {
    const actions = testActions();
    gameState.value = colony(1);
    const before = gameState.value;
    expect(actions.dig().ok).toBe(true);
    expect(gameState.value.dig.progress + gameState.value.dig.roomsDug).toBeGreaterThan(before.dig.progress + before.dig.roomsDug);
  });
});

describe('diggers dig on their own', () => {
  const system = new ResourceSystem(new EventBus());
  const secondsForRoom = (s: GameState) => Math.ceil(roomCost(s.dig.roomsDug) / diggerPointsPerSec(s));

  it('slowly: no digger, no digging; diggers open a room in time', () => {
    expect(diggerPointsPerSec(colony(0))).toBe(0);
    const s = colony(4);
    expect(diggerPointsPerSec(s)).toBeGreaterThan(0);
    const after = system.tick(s, undefined, secondsForRoom(s));
    expect(after.dig.roomsDug).toBeGreaterThan(s.dig.roomsDug);
    expect(after.resources.nestCapacity).toBeGreaterThan(s.resources.nestCapacity);
  });

  it('Tunnels speed them up', () => {
    const s = colony(4);
    const t = { ...s, buildings: { ...s.buildings, tunnels: { level: 2 } } };
    expect(diggerPointsPerSec(t)).toBeGreaterThan(diggerPointsPerSec(s));
  });

  it('give the same result for any step length', () => {
    const s = colony(7);
    const total = secondsForRoom(s) * 3;
    const long = system.tick(s, undefined, total);
    let fine = s;
    const steps = 300;
    for (let i = 0; i < steps; i++) fine = system.tick(fine, undefined, total / steps);
    expect(fine.dig.roomsDug).toBe(long.dig.roomsDug);
    expect(fine.resources.nestCapacity).toBe(long.resources.nestCapacity);
    expect(Math.abs(digPoints(fine) - digPoints(long))).toBeLessThanOrEqual(1);
    expect(Number.isInteger(long.dig.progress)).toBe(true);
    expect(Number.isInteger(long.resources.nestCapacity)).toBe(true);
  });
});
