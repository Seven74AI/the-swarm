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
    it('returns correct cost for scout ship level 1', () => {
      const cost = getBuildCost('scout_ship', 1);
      expect(cost).toEqual({
        food: 500,
        wood: 200,
        stone: 200,
        nectar: 100,
        voidCrystals: 50,
        antimatter: 10,
        darkMatter: 5,
      });
    });

    it('returns correct cost for cruiser level 1', () => {
      const cost = getBuildCost('cruiser', 1);
      expect(cost).toEqual({
        food: 1500,
        wood: 500,
        stone: 500,
        nectar: 300,
        voidCrystals: 200,
        antimatter: 50,
        darkMatter: 20,
      });
    });

    it('returns correct cost for capital ship level 1', () => {
      const cost = getBuildCost('capital_ship', 1);
      expect(cost).toEqual({
        food: 5000,
        wood: 1500,
        stone: 1500,
        nectar: 1000,
        voidCrystals: 800,
        antimatter: 200,
        darkMatter: 100,
      });
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
      expect(result.resources.food).toBe(100);
      expect(result.resources.voidCrystals).toBe(50);
      expect(result.resources.antimatter).toBe(10);
      expect(result.resources.darkMatter).toBe(5);
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
    it('returns upgrade cost for level 1 → 2 for scout ship', () => {
      const cost = getUpgradeCost('scout_ship', 1);
      expect(cost).toEqual({
        food: 250,
        wood: 100,
        stone: 100,
        nectar: 50,
        voidCrystals: 100,
        antimatter: 20,
        darkMatter: 10,
      });
    });

    it('returns upgrade cost for level 2 → 3 for scout ship (scales)', () => {
      const cost = getUpgradeCost('scout_ship', 2);
      expect(cost).toEqual({
        food: 500,
        wood: 200,
        stone: 200,
        nectar: 100,
        voidCrystals: 200,
        antimatter: 40,
        darkMatter: 20,
      });
    });

    it('returns upgrade cost for cruiser level 1 → 2', () => {
      const cost = getUpgradeCost('cruiser', 1);
      expect(cost).toEqual({
        food: 750,
        wood: 250,
        stone: 250,
        nectar: 150,
        voidCrystals: 400,
        antimatter: 100,
        darkMatter: 40,
      });
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

      const result = upgrade(shipId, state);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.level).toBe(2);
      expect(ship.maxFuel).toBe(getFuelCapacity('scout_ship', 2));
      // Resources were deducted
      const cost = getUpgradeCost('scout_ship', 1);
      expect(result.resources.voidCrystals).toBe(state.resources.voidCrystals - cost.voidCrystals);
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
    it('returns fuel capacity for scout ship level 1', () => {
      expect(getFuelCapacity('scout_ship', 1)).toBe(100);
    });

    it('returns fuel capacity for scout ship level 3', () => {
      expect(getFuelCapacity('scout_ship', 3)).toBe(200);
    });

    it('returns fuel capacity for cruiser level 1', () => {
      expect(getFuelCapacity('cruiser', 1)).toBe(250);
    });

    it('returns fuel capacity for capital ship level 1', () => {
      expect(getFuelCapacity('capital_ship', 1)).toBe(500);
    });

    it('returns fuel capacity for max level capital ship', () => {
      expect(getFuelCapacity('capital_ship', 5)).toBe(900);
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
      const crystalsAfterBuild = state.resources.voidCrystals; // 450 (500 - 50 build cost)
      const shipId = state.spaceships[0].id;

      const result = refuel(shipId, 40, state);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.fuel).toBe(40);
      // voidCrystals consumed at 1:1 ratio (40 fuel = 40 crystals)
      expect(result.resources.voidCrystals).toBe(crystalsAfterBuild - 40);
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
      const crystalsAfterBuild = state.resources.voidCrystals; // 450
      const shipId = state.spaceships[0].id;
      const maxFuel = state.spaceships[0].maxFuel; // 100

      const result = refuel(shipId, maxFuel + 50, state);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.fuel).toBe(maxFuel);
      expect(result.resources.voidCrystals).toBe(crystalsAfterBuild - maxFuel);
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
      result = refuel(shipId, 20, result);
      const ship = result.spaceships.find((s) => s.id === shipId)!;
      expect(ship.fuel).toBe(50);
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
      expect(getFuelCapacity('scout_ship', 5)).toBeGreaterThan(0);
      expect(getFuelCapacity('scout_ship', 6)).toBe(getFuelCapacity('scout_ship', 5));
    });

    it('scout ship fuel capacity scales: level 1 = 100, level 5 = 300', () => {
      expect(getFuelCapacity('scout_ship', 1)).toBe(100);
      expect(getFuelCapacity('scout_ship', 5)).toBe(300);
    });

    it('default spaceships array is empty', () => {
      expect(state.spaceships).toEqual([]);
    });
  });
});
