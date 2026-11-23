import { describe, it, expect } from 'vitest';
import { Phase } from '../../../src/phases/phases';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { build, canBuild, getBuildCost, getEffects, isBuildingOpen, type BuildingType } from '../../../src/systems/BuildingSystem';
import { ResourceSystem, computeResourceRates } from '../../../src/systems/ResourceSystem';
import { prestige } from '../../../src/systems/PrestigeSystem';
import { EventBus } from '../../../src/engine/EventBus';
import { roleBalance } from '../../../src/data/balance/roles';
import { MS_PER_SEC } from '../../../src/data/constants';
import { FIRST_PRODUCED_IN } from '../../../src/data/content/producers';
import { digBalance } from '../../../src/data/balance/dig';
import { roomCost } from '../../../src/systems/Dig';

/**
 * Story 4.7 (FR19): the Colony's own new buildings. The Fungus Garden makes
 * every gatherer bring in more food; Tunnels make every digger dig rooms
 * faster. Both cost nectar, so FORAGE has a use in Colony. Invariants only.
 */

const NEW: readonly BuildingType[] = ['fungus_garden', 'tunnels'];

function colony(patch: (s: GameState) => void = () => {}): GameState {
  const s = { ...createInitialState(), phase: Phase.COLONY };
  s.resources = { ...s.resources, workers: 20, nestCapacity: 1000 };
  patch(s);
  return s;
}

const withLevel = (s: GameState, b: BuildingType, level: number): GameState => ({
  ...s,
  buildings: { ...s.buildings, [b]: { ...s.buildings[b], level } },
});

describe('Colony buildings (Story 4.7)', () => {
  it('both are on sale in Colony, not before, and priced in Colony currencies including nectar', () => {
    for (const b of NEW) {
      expect(isBuildingOpen(b, colony()), b).toBe(true);
      expect(isBuildingOpen(b, { ...colony(), phase: Phase.EGG_LAYING }), b).toBe(false);
      const cost = getBuildCost(b, 1);
      expect(cost.nectar, b).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(cost)) if (v > 0) expect(FIRST_PRODUCED_IN[k as keyof typeof FIRST_PRODUCED_IN], `${b} ${k}`).not.toBe(undefined);
    }
  });

  it('buying one spends its price and raises its level by one', () => {
    for (const b of NEW) {
      const s = colony((x) => {
        x.resources = { ...x.resources, food: 1e9, wood: 1e9, stone: 1e9, nectar: 1e9 };
      });
      expect(canBuild(b, s), b).toBe(true);
      const after = build(b, s);
      expect(after.buildings[b].level).toBe(s.buildings[b].level + 1);
      expect(after.resources.nectar).toBeLessThan(s.resources.nectar);
      for (const k of ['food', 'wood', 'stone', 'nectar'] as const) expect(Number.isInteger(after.resources[k]), k).toBe(true);
    }
  });

  it("each level's effect is bigger than the last", () => {
    for (const b of NEW) {
      const key = b === 'fungus_garden' ? 'gatherFoodBonus' : 'digSpeedBonus';
      expect(getEffects(b, 0)[key] ?? 0).toBe(0);
      for (let level = 1; level <= 8; level++) expect(getEffects(b, level)[key], `${b} ${level}`).toBeGreaterThan(getEffects(b, level - 1)[key] ?? 0);
    }
  });

  describe('Fungus Garden', () => {
    const gatherers = (n: number) => colony((s) => (s.workersAssigned = { ...s.workersAssigned, gather: n }));

    it('gatherers bring in more food with it', () => {
      const without = computeResourceRates(gatherers(10)).foodProducedPerSec;
      const with1 = computeResourceRates(withLevel(gatherers(10), 'fungus_garden', 1)).foodProducedPerSec;
      const with2 = computeResourceRates(withLevel(gatherers(10), 'fungus_garden', 2)).foodProducedPerSec;
      expect(with1).toBeGreaterThan(without);
      expect(with2).toBeGreaterThan(with1);
    });

    it('feeds only gatherers: with no gatherer, food income is unchanged', () => {
      const s = gatherers(0);
      expect(computeResourceRates(withLevel(s, 'fungus_garden', 3)).foodProducedPerSec).toBe(computeResourceRates(s).foodProducedPerSec);
    });

    it('changes nothing but food', () => {
      const s = gatherers(10);
      const a = computeResourceRates(s);
      const b = computeResourceRates(withLevel(s, 'fungus_garden', 3));
      expect(b.woodPerSec).toBe(a.woodPerSec);
      expect(b.foodConsumedPerSec).toBe(a.foodConsumedPerSec);
    });
  });

  describe('Tunnels', () => {
    const system = new ResourceSystem(new EventBus());
    // One digger's time for the first room (Story 9.2), read from the balance.
    const ROOM_SEC = roomCost(0) / digBalance.diggerPointsPerSec;
    const diggers = (n: number) => colony((s) => (s.workersAssigned = { ...s.workersAssigned, dig: n }));
    const rooms = (s: GameState, sec: number) => system.tick(s, undefined, sec).resources.nestCapacity - s.resources.nestCapacity;

    it('the same diggers dig more rooms in the same time', () => {
      const without = rooms(diggers(10), ROOM_SEC * 4);
      const with1 = rooms(withLevel(diggers(10), 'tunnels', 1), ROOM_SEC * 4);
      const with2 = rooms(withLevel(diggers(10), 'tunnels', 2), ROOM_SEC * 4);
      expect(with1).toBeGreaterThan(without);
      expect(with2).toBeGreaterThan(with1);
      expect(Number.isInteger(with2)).toBe(true);
    });

    it('digs nothing without diggers', () => {
      expect(rooms(withLevel(diggers(0), 'tunnels', 3), ROOM_SEC * 4)).toBe(0);
    });

    it('one long step digs what many short ones do (within one room)', () => {
      const s = withLevel(diggers(7), 'tunnels', 2);
      let fine = s;
      for (let i = 0; i < 40; i++) fine = system.tick(fine, undefined, ROOM_SEC / 10);
      const coarse = system.tick(s, undefined, ROOM_SEC * 4);
      expect(Math.abs(fine.resources.nestCapacity - coarse.resources.nestCapacity)).toBeLessThanOrEqual(digBalance.roomSize);
    });
  });

  it('prestige wipes them like the other buildings', () => {
    let s = colony();
    for (const b of NEW) s = withLevel(s, b, 3);
    const after = prestige(s);
    for (const b of NEW) expect(after.buildings[b].level, b).toBe(0);
  });
});
