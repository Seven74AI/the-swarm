import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBuildCost,
  canBuild,
  construct,
  getUpgradeCost,
  canUpgrade,
  upgrade,
  getFuelCapacity,
  refuel,
  launchMission,
  tickMissions,
  resolveMission,
  type SpaceshipType,
  type Spaceship,
} from '../../src/systems/SpaceshipSystem';
import { createInitialState, type GameState } from '../../src/state/GameState';

const ALL_SHIP_TYPES: SpaceshipType[] = ['scout_ship', 'cruiser', 'capital_ship'];

/** All cost fields for directional checks. */
const COST_FIELDS = ['food', 'wood', 'stone', 'nectar', 'voidCrystals', 'antimatter', 'darkMatter'] as const;

describe('SpaceshipSystem', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  // ─── HELPERS ─────────────────────────────────────────
  /** Create and fully fuel a scout ship, returning [state, shipId]. */
  function seedShip(state: GameState): [GameState, string] {
    state.resources.food = 1000;
    state.resources.wood = 500;
    state.resources.stone = 500;
    state.resources.nectar = 300;
    state.resources.voidCrystals = 500;
    state.resources.antimatter = 100;
    state.resources.darkMatter = 50;
    state = construct('scout_ship', state);
    const shipId = state.spaceships[0].id;
    state = refuel(shipId, 100, state);
    return [state, shipId];
  }

  /** Create, fuel, launch, and tick a ship to completion, returning [state, Spaceship]. */
  function launchedShip(baseState: GameState): [GameState, Spaceship] {
    baseState.resources.food = 10000;
    baseState.resources.wood = 5000;
    baseState.resources.stone = 5000;
    baseState.resources.nectar = 3000;
    baseState.resources.voidCrystals = 2000;
    baseState.resources.antimatter = 500;
    baseState.resources.darkMatter = 200;

    let s = construct('scout_ship', baseState);
    const ship = s.spaceships[0];
    s = refuel(ship.id, 100, s);
    s = launchMission(ship.id, 'Alpha Centauri', s);
    const totalTicks = s.spaceships[0].missionTicksRemaining;
    for (let i = 0; i < totalTicks; i++) {
      s = tickMissions(s);
    }
    return [s, s.spaceships[0]];
  }

  // ─── CONSTRUCTION ────────────────────────────────────────
  describe('getBuildCost', () => {
    it('returns a positive, non-zero cost for every ship type', () => {
      for (const type of ALL_SHIP_TYPES) {
        const cost = getBuildCost(type, 1);
        expect(cost.food).toBeGreaterThan(0);
        expect(cost.wood).toBeGreaterThan(0);
        expect(cost.stone).toBeGreaterThan(0);
        expect(cost.nectar).toBeGreaterThan(0);
        expect(cost.voidCrystals).toBeGreaterThan(0);
        expect(cost.antimatter).toBeGreaterThan(0);
        expect(cost.darkMatter).toBeGreaterThan(0);
        // Total cost is non-trivial
        const total = COST_FIELDS.reduce((s, k) => s + cost[k], 0);
        expect(total).toBeGreaterThan(0);
      }
    });

    it('costs scale by level for all ship types', () => {
      for (const type of ALL_SHIP_TYPES) {
        const lv1 = getBuildCost(type, 1);
        const lv2 = getBuildCost(type, 2);
        for (const field of COST_FIELDS) {
          expect(lv2[field]).toBeGreaterThanOrEqual(lv1[field]);
        }
        expect(lv2.food).toBeGreaterThan(lv1.food);
      }
    });

    it('higher ship tiers cost more (basic resources)', () => {
      const scout = getBuildCost('scout_ship', 1);
      const cruiser = getBuildCost('cruiser', 1);
      const capital = getBuildCost('capital_ship', 1);

      // Each higher tier should cost more in every resource
      expect(cruiser.food).toBeGreaterThan(scout.food);
      expect(cruiser.voidCrystals).toBeGreaterThan(scout.voidCrystals);
      expect(cruiser.antimatter).toBeGreaterThan(scout.antimatter);
      expect(cruiser.darkMatter).toBeGreaterThan(scout.darkMatter);

      expect(capital.food).toBeGreaterThan(cruiser.food);
      expect(capital.voidCrystals).toBeGreaterThan(cruiser.voidCrystals);
      expect(capital.antimatter).toBeGreaterThan(cruiser.antimatter);
      expect(capital.darkMatter).toBeGreaterThan(cruiser.darkMatter);
    });

    it('space resource costs are present at all tiers', () => {
      for (const type of ALL_SHIP_TYPES) {
        const cost = getBuildCost(type, 1);
        // Ships always need space resources
        expect(cost.voidCrystals).toBeGreaterThan(0);
        expect(cost.antimatter).toBeGreaterThan(0);
        expect(cost.darkMatter).toBeGreaterThan(0);
      }
    });
  });

  describe('canBuild', () => {
    it('returns true when resources are sufficient', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 100;
      state.resources.antimatter = 20;
      state.resources.darkMatter = 10;
      expect(canBuild('scout_ship', state)).toBe(true);
    });

    it('returns false when not enough voidCrystals', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 10;
      state.resources.antimatter = 20;
      state.resources.darkMatter = 10;
      expect(canBuild('scout_ship', state)).toBe(false);
    });

    it('returns false when not enough antimatter', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 100;
      state.resources.antimatter = 5;
      state.resources.darkMatter = 10;
      expect(canBuild('scout_ship', state)).toBe(false);
    });

    it('returns false when not enough darkMatter', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 100;
      state.resources.antimatter = 20;
      state.resources.darkMatter = 2;
      expect(canBuild('scout_ship', state)).toBe(false);
    });

    it('returns false when not enough food', () => {
      state.resources.food = 100;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 100;
      state.resources.antimatter = 20;
      state.resources.darkMatter = 10;
      expect(canBuild('scout_ship', state)).toBe(false);
    });
  });

  describe('construct', () => {
    it('creates a scout ship and deducts resources', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 100;
      state.resources.antimatter = 20;
      state.resources.darkMatter = 10;

      const result = construct('scout_ship', state);
      expect(result.spaceships.length).toBe(1);
      const ship = result.spaceships[0];
      expect(ship.type).toBe('scout_ship');
      expect(ship.level).toBe(1);
      expect(ship.fuel).toBe(0);
      expect(ship.status).toBe('idle');

      // Resources were deducted for construction
      expect(result.resources.food).toBeLessThan(state.resources.food);
      expect(result.resources.voidCrystals).toBeLessThan(state.resources.voidCrystals);
      expect(result.resources.antimatter).toBeLessThan(state.resources.antimatter);
      expect(result.resources.darkMatter).toBeLessThan(state.resources.darkMatter);

      // Resources never go negative
      expect(result.resources.food).toBeGreaterThanOrEqual(0);
      expect(result.resources.voidCrystals).toBeGreaterThanOrEqual(0);
      expect(result.resources.antimatter).toBeGreaterThanOrEqual(0);
      expect(result.resources.darkMatter).toBeGreaterThanOrEqual(0);
    });

    it('does not create ship when insufficient resources', () => {
      const result = construct('scout_ship', state);
      expect(result).toBe(state);
      expect(result.spaceships.length).toBe(0);
    });

    it('creates multiple spaceships of different types', () => {
      // Set up rich resources
      state.resources.food = 10000;
      state.resources.wood = 5000;
      state.resources.stone = 5000;
      state.resources.nectar = 3000;
      state.resources.voidCrystals = 2000;
      state.resources.antimatter = 500;
      state.resources.darkMatter = 300;

      let result = construct('scout_ship', state);
      result = construct('cruiser', result);
      expect(result.spaceships.length).toBe(2);
      expect(result.spaceships[0].type).toBe('scout_ship');
      expect(result.spaceships[1].type).toBe('cruiser');
    });
  });

  // ─── UPGRADES ──────────────────────────────────────────
  describe('getUpgradeCost', () => {
    it('returns a positive, non-zero upgrade cost for all ship types', () => {
      for (const type of ALL_SHIP_TYPES) {
        const cost = getUpgradeCost(type, 1);
        expect(cost.food).toBeGreaterThan(0);
        expect(cost.wood).toBeGreaterThan(0);
        expect(cost.stone).toBeGreaterThan(0);
        expect(cost.nectar).toBeGreaterThan(0);
        expect(cost.voidCrystals).toBeGreaterThan(0);
        expect(cost.antimatter).toBeGreaterThan(0);
        expect(cost.darkMatter).toBeGreaterThan(0);
      }
    });

    it('upgrade costs scale with level for scout ship', () => {
      const lv1to2 = getUpgradeCost('scout_ship', 1);
      const lv2to3 = getUpgradeCost('scout_ship', 2);

      // Higher current level → higher upgrade cost
      expect(lv2to3.food).toBeGreaterThanOrEqual(lv1to2.food);
      expect(lv2to3.voidCrystals).toBeGreaterThanOrEqual(lv1to2.voidCrystals);
      expect(lv2to3.antimatter).toBeGreaterThanOrEqual(lv1to2.antimatter);
      expect(lv2to3.darkMatter).toBeGreaterThanOrEqual(lv1to2.darkMatter);
    });

    it('upgrade cost does not exceed build cost of same level', () => {
      for (const type of ALL_SHIP_TYPES) {
        const build = getBuildCost(type, 2);
        const upgrade = getUpgradeCost(type, 1);
        // Upgrading (L1→L2) should not cost more per field than building a fresh L2
        for (const field of COST_FIELDS) {
          expect(upgrade[field]).toBeLessThanOrEqual(build[field]);
        }
        // Total upgrade cost is cheaper than total build cost
        const totalUpgrade = COST_FIELDS.reduce((s, k) => s + upgrade[k], 0);
        const totalBuild = COST_FIELDS.reduce((s, k) => s + build[k], 0);
        expect(totalUpgrade).toBeLessThan(totalBuild);
      }
    });

    it('higher tier ships have more expensive upgrades', () => {
      const scout = getUpgradeCost('scout_ship', 1);
      const cruiser = getUpgradeCost('cruiser', 1);
      const capital = getUpgradeCost('capital_ship', 1);

      expect(cruiser.food).toBeGreaterThan(scout.food);
      expect(cruiser.voidCrystals).toBeGreaterThan(scout.voidCrystals);
      expect(cruiser.antimatter).toBeGreaterThan(scout.antimatter);
      expect(cruiser.darkMatter).toBeGreaterThan(scout.darkMatter);

      expect(capital.food).toBeGreaterThan(cruiser.food);
      expect(capital.voidCrystals).toBeGreaterThan(cruiser.voidCrystals);
      expect(capital.antimatter).toBeGreaterThan(cruiser.antimatter);
      expect(capital.darkMatter).toBeGreaterThan(cruiser.darkMatter);
    });
  });

  describe('canUpgrade', () => {
    it('returns true when resources are sufficient for upgrade', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 200;
      state.resources.antimatter = 50;
      state.resources.darkMatter = 20;

      // Build a scout ship first
      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;

      // Set enough resources for upgrade
      state.resources.food = 500;
      state.resources.voidCrystals = 200;
      state.resources.antimatter = 50;
      state.resources.darkMatter = 20;

      expect(canUpgrade(shipId, state)).toBe(true);
    });

    it('returns false when insufficient voidCrystals for upgrade', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 200;
      state.resources.antimatter = 50;
      state.resources.darkMatter = 20;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;
      state.resources.voidCrystals = 10;

      expect(canUpgrade(shipId, state)).toBe(false);
    });

    it('returns false for non-existent spaceship', () => {
      expect(canUpgrade('nonexistent', state)).toBe(false);
    });

    it('returns false for spaceship at max level', () => {
      state.resources.food = 600;
      state.resources.wood = 300;
      state.resources.stone = 300;
      state.resources.nectar = 200;
      state.resources.voidCrystals = 200;
      state.resources.antimatter = 50;
      state.resources.darkMatter = 20;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;
      state.spaceships[0].level = 5;

      expect(canUpgrade(shipId, state)).toBe(false);
    });
  });

  describe('upgrade', () => {
    it('increments spaceship level and deducts resources', () => {
      state.resources.food = 2000;
      state.resources.wood = 1000;
      state.resources.stone = 1000;
      state.resources.nectar = 500;
      state.resources.voidCrystals = 500;
      state.resources.antimatter = 200;
      state.resources.darkMatter = 100;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;

      const beforeVoidCrystals = state.resources.voidCrystals;
      const result = upgrade(shipId, state);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.level).toBe(2);
      expect(ship.maxFuel).toBe(getFuelCapacity('scout_ship', 2));

      // Resources were deducted
      expect(result.resources.food).toBeLessThan(state.resources.food);
      expect(result.resources.voidCrystals).toBeLessThan(beforeVoidCrystals);
      // No resource goes negative
      expect(result.resources.voidCrystals).toBeGreaterThanOrEqual(0);
    });

    it('does not modify state for non-existent spaceship', () => {
      const result = upgrade('nonexistent', state);
      expect(result).toBe(state);
    });

    it('levels up from 2 to 3', () => {
      state.resources.food = 5000;
      state.resources.wood = 2000;
      state.resources.stone = 2000;
      state.resources.nectar = 1000;
      state.resources.voidCrystals = 1000;
      state.resources.antimatter = 500;
      state.resources.darkMatter = 200;

      state = construct('scout_ship', state);
      const ship = state.spaceships[0];
      // First upgrade to level 2
      state = upgrade(ship.id, state);
      // Then upgrade to level 3
      const result = upgrade(ship.id, state);
      const upgraded = result.spaceships.find((s) => s.id === ship.id)!;
      expect(upgraded.level).toBe(3);
    });
  });

  // ─── FUEL MECHANICS ────────────────────────────────────
  describe('getFuelCapacity', () => {
    it('returns positive fuel capacity for all ship types at level 1', () => {
      for (const type of ALL_SHIP_TYPES) {
        expect(getFuelCapacity(type, 1)).toBeGreaterThan(0);
      }
    });

    it('fuel capacity increases with level for all ship types', () => {
      for (const type of ALL_SHIP_TYPES) {
        const lv1 = getFuelCapacity(type, 1);
        const lv3 = getFuelCapacity(type, 3);
        expect(lv3).toBeGreaterThan(lv1);
      }
    });

    it('higher ship tiers have higher fuel capacity', () => {
      const scout = getFuelCapacity('scout_ship', 1);
      const cruiser = getFuelCapacity('cruiser', 1);
      const capital = getFuelCapacity('capital_ship', 1);

      expect(cruiser).toBeGreaterThan(scout);
      expect(capital).toBeGreaterThan(cruiser);
    });

    it('fuel capacity caps at max level', () => {
      for (const type of ALL_SHIP_TYPES) {
        const maxLevel = getFuelCapacity(type, 5);
        const beyond = getFuelCapacity(type, 6);
        // Beyond max level returns same capacity
        expect(beyond).toBe(maxLevel);
        expect(maxLevel).toBeGreaterThan(0);
      }
    });
  });

  describe('refuel', () => {
    it('refuels spaceship by consuming voidCrystals', () => {
      state.resources.food = 1000;
      state.resources.wood = 500;
      state.resources.stone = 500;
      state.resources.nectar = 300;
      state.resources.voidCrystals = 500;
      state.resources.antimatter = 100;
      state.resources.darkMatter = 50;

      state = construct('scout_ship', state);
      const beforeVoidCrystals = state.resources.voidCrystals;
      const shipId = state.spaceships[0].id;

      const result = refuel(shipId, 40, state);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.fuel).toBeGreaterThan(0);
      // voidCrystals were consumed
      expect(result.resources.voidCrystals).toBeLessThan(beforeVoidCrystals);
    });

    it('caps refuel at maxFuel capacity', () => {
      state.resources.food = 1000;
      state.resources.wood = 500;
      state.resources.stone = 500;
      state.resources.nectar = 300;
      state.resources.voidCrystals = 500;
      state.resources.antimatter = 100;
      state.resources.darkMatter = 50;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;
      const maxFuel = state.spaceships[0].maxFuel;

      const result = refuel(shipId, maxFuel + 50, state);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.fuel).toBeLessThanOrEqual(maxFuel);
      // voidCrystals were consumed but not more than maxFuel
      expect(result.resources.voidCrystals).toBeLessThan(state.resources.voidCrystals);
    });

    it('does nothing for non-existent spaceship', () => {
      const result = refuel('nonexistent', 10, state);
      expect(result).toBe(state);
    });

    it('does nothing when not enough voidCrystals', () => {
      state.resources.food = 1000;
      state.resources.wood = 500;
      state.resources.stone = 500;
      state.resources.nectar = 300;
      // Enough to build the ship...
      state.resources.voidCrystals = 100;
      state.resources.antimatter = 100;
      state.resources.darkMatter = 50;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;
      // Drain voidCrystals so refuel fails
      state.resources.voidCrystals = 0;

      const result = refuel(shipId, 50, state);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.fuel).toBe(0);
    });

    it('adds to existing fuel', () => {
      state.resources.food = 1000;
      state.resources.wood = 500;
      state.resources.stone = 500;
      state.resources.nectar = 300;
      state.resources.voidCrystals = 500;
      state.resources.antimatter = 100;
      state.resources.darkMatter = 50;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;

      let result = refuel(shipId, 30, state);
      const fuelAfterFirst = result.spaceships.find((s) => s.id === shipId)!.fuel;
      result = refuel(shipId, 20, result);
      const fuelAfterSecond = result.spaceships.find((s) => s.id === shipId)!.fuel;
      expect(fuelAfterSecond).toBeGreaterThan(fuelAfterFirst);
    });
  });

  // ─── MISSIONS ──────────────────────────────────────────
  describe('launchMission', () => {
    it('launches a fueled ship on a mission', () => {
      const [gameState, shipId] = seedShip(state);
      const result = launchMission(shipId, 'Alpha Centauri', gameState);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.status).toBe('exploring');
      expect(ship.destinationName).toBe('Alpha Centauri');
      expect(ship.missionTicksRemaining).toBeGreaterThan(0);
      expect(ship.fuel).toBeLessThan(100); // consumed fuel
    });

    it('does not launch a ship with insufficient fuel', () => {
      state.resources.food = 1000;
      state.resources.wood = 500;
      state.resources.stone = 500;
      state.resources.nectar = 300;
      state.resources.voidCrystals = 500;
      state.resources.antimatter = 100;
      state.resources.darkMatter = 50;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;
      // Don't refuel — fuel is 0
      const result = launchMission(shipId, 'Alpha Centauri', state);
      expect(result).toBe(state);
    });

    it('does not launch a ship already on a mission', () => {
      const [gameState, shipId] = seedShip(state);
      const launched = launchMission(shipId, 'Alpha Centauri', gameState);
      const doubleLaunch = launchMission(shipId, 'Beta Sector', launched);
      expect(doubleLaunch).toBe(launched);
      const ship = doubleLaunch.spaceships.find((s) => s.id === shipId)!;
      expect(ship.destinationName).toBe('Alpha Centauri'); // unchanged
    });

    it('does not launch non-existent ship', () => {
      const result = launchMission('nonexistent', 'Space', state);
      expect(result).toBe(state);
    });

    it('consumes fuel proportional to distance', () => {
      const [gameState, shipId] = seedShip(state);
      const result = launchMission(shipId, 'Nearby Nebula', gameState);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.fuel).toBeLessThan(100);
      expect(ship.fuel).toBeGreaterThan(0);
    });
  });

  describe('tickMissions', () => {
    it('decrements mission timers', () => {
      const [gameState, shipId] = seedShip(state);
      const launched = launchMission(shipId, 'Alpha Centauri', gameState);
      const initialTicks = launched.spaceships[0].missionTicksRemaining;

      const result = tickMissions(launched);
      const ship = result.spaceships[0];
      expect(ship.missionTicksRemaining).toBe(initialTicks - 1);
    });

    it('does nothing when no missions are active', () => {
      const result = tickMissions(state);
      expect(result).toBe(state);
    });

    it('sets status to returning when timer reaches 0', () => {
      // We need to tick until the mission is done
      const [gameState, shipId] = seedShip(state);
      let launched = launchMission(shipId, 'Alpha Centauri', gameState);
      const totalTicks = launched.spaceships[0].missionTicksRemaining;

      for (let i = 0; i < totalTicks; i++) {
        launched = tickMissions(launched);
      }
      // After timer hits 0, status should change to 'returning'
      const ship = launched.spaceships[0];
      expect(ship.status).toBe('returning');
      expect(ship.missionTicksRemaining).toBe(0);
    });
  });

  describe('resolveMission', () => {
    it('resolves mission and returns spaceship to idle', () => {
      const [gameState, ship] = launchedShip(state);
      const result = resolveMission(ship.id, gameState);
      const resolved = result.spaceships.find((s) => s.id === ship.id)!;
      expect(resolved.status).toBe('idle');
      expect(resolved.missionTicksRemaining).toBe(0);
    });

    it('grants space loot on successful return', () => {
      const [gameState, ship] = launchedShip(state);
      const result = resolveMission(ship.id, gameState);
      // Should get some voidCrystals, antimatter, or darkMatter
      const gained =
        (result.resources.voidCrystals ?? 0) -
        (gameState.resources.voidCrystals ?? 0) +
        (result.resources.antimatter ?? 0) -
        (gameState.resources.antimatter ?? 0) +
        (result.resources.darkMatter ?? 0) -
        (gameState.resources.darkMatter ?? 0);
      expect(gained).toBeGreaterThan(0);
    });

    it('does nothing for non-existent spaceship', () => {
      const result = resolveMission('nonexistent', state);
      expect(result).toBe(state);
    });

    it('does nothing for idle spaceship', () => {
      state.resources.food = 1000;
      state.resources.wood = 500;
      state.resources.stone = 500;
      state.resources.nectar = 300;
      state.resources.voidCrystals = 500;
      state.resources.antimatter = 100;
      state.resources.darkMatter = 50;

      state = construct('scout_ship', state);
      const shipId = state.spaceships[0].id;
      const result = resolveMission(shipId, state);
      expect(result).toBe(state);
    });
  });

  // ─── EDGE CASES ───────────────────────────────────────
  describe('edge cases', () => {
    it('max level is 5 for all ship types', () => {
      for (const type of ALL_SHIP_TYPES) {
        const max = getFuelCapacity(type, 5);
        const beyond = getFuelCapacity(type, 6);
        // Beyond max level caps at max level capacity
        expect(beyond).toBe(max);
        expect(max).toBeGreaterThan(0);
      }
    });

    it('scout ship fuel capacity increases with level', () => {
      const lv1 = getFuelCapacity('scout_ship', 1);
      const lv2 = getFuelCapacity('scout_ship', 2);
      const lv5 = getFuelCapacity('scout_ship', 5);
      expect(lv2).toBeGreaterThan(lv1);
      expect(lv5).toBeGreaterThan(lv2);
    });

    it('default spaceships array is empty', () => {
      expect(state.spaceships).toEqual([]);
    });
  });
});
