import type { GameState } from '../state/GameState';

export type SpaceshipType = 'scout_ship' | 'cruiser' | 'capital_ship';
export type SpaceshipStatus = 'idle' | 'exploring' | 'returning';

export interface Spaceship {
  id: string;
  type: SpaceshipType;
  level: number;
  fuel: number;
  maxFuel: number;
  status: SpaceshipStatus;
  missionTicksRemaining: number;
  destinationName: string;
}

export interface Cost {
  food: number;
  wood: number;
  stone: number;
  nectar: number;
  voidCrystals: number;
  antimatter: number;
  darkMatter: number;
}

const MAX_LEVEL = 5;

function generateId(state: GameState): string {
  return `ship_${Date.now()}_${state.nextIds.spaceship}`;
}

// ─── BASE COSTS ─────────────────────────────────────────

const BUILD_BASE_COSTS: Record<SpaceshipType, Cost> = {
  scout_ship: {
    food: 500,
    wood: 200,
    stone: 200,
    nectar: 100,
    voidCrystals: 15,
    antimatter: 10,
    darkMatter: 5,
  },
  cruiser: {
    food: 1500,
    wood: 500,
    stone: 500,
    nectar: 300,
    voidCrystals: 200,
    antimatter: 50,
    darkMatter: 20,
  },
  capital_ship: {
    food: 5000,
    wood: 1500,
    stone: 1500,
    nectar: 1000,
    voidCrystals: 800,
    antimatter: 200,
    darkMatter: 100,
  },
};

// Upgrade costs are 50% of build cost, scaled by current level
const UPGRADE_BASE_RATIO = 0.5;

// ─── FUEL ───────────────────────────────────────────────

const FUEL_BASE: Record<SpaceshipType, number> = {
  scout_ship: 100,
  cruiser: 250,
  capital_ship: 500,
};

const FUEL_PER_LEVEL: Record<SpaceshipType, number> = {
  scout_ship: 50,
  cruiser: 75,
  capital_ship: 100,
};

// ─── CONSTRUCTION ───────────────────────────────────────

export function getBuildCost(type: SpaceshipType, level: number): Cost {
  const base = BUILD_BASE_COSTS[type];
  return {
    food: base.food * level,
    wood: base.wood * level,
    stone: base.stone * level,
    nectar: base.nectar * level,
    voidCrystals: base.voidCrystals * level,
    antimatter: base.antimatter * level,
    darkMatter: base.darkMatter * level,
  };
}

export function canBuild(type: SpaceshipType, state: GameState): boolean {
  const cost = getBuildCost(type, 1);
  return (
    state.resources.food >= cost.food &&
    state.resources.wood >= cost.wood &&
    state.resources.stone >= cost.stone &&
    state.resources.nectar >= cost.nectar &&
    state.resources.voidCrystals >= cost.voidCrystals &&
    state.resources.antimatter >= cost.antimatter &&
    state.resources.darkMatter >= cost.darkMatter
  );
}

export function construct(type: SpaceshipType, state: GameState): GameState {
  const cost = getBuildCost(type, 1);

  if (
    state.resources.food < cost.food ||
    state.resources.wood < cost.wood ||
    state.resources.stone < cost.stone ||
    state.resources.nectar < cost.nectar ||
    state.resources.voidCrystals < cost.voidCrystals ||
    state.resources.antimatter < cost.antimatter ||
    state.resources.darkMatter < cost.darkMatter
  ) {
    return state;
  }

  const maxFuel = getFuelCapacity(type, 1);
  const ship: Spaceship = {
    id: generateId(state),
    type,
    level: 1,
    fuel: 0,
    maxFuel,
    status: 'idle',
    missionTicksRemaining: 0,
    destinationName: '',
  };

  return {
    ...state,
    nextIds: { ...state.nextIds, spaceship: state.nextIds.spaceship + 1 },
    resources: {
      ...state.resources,
      food: state.resources.food - cost.food,
      wood: state.resources.wood - cost.wood,
      stone: state.resources.stone - cost.stone,
      nectar: state.resources.nectar - cost.nectar,
      voidCrystals: state.resources.voidCrystals - cost.voidCrystals,
      antimatter: state.resources.antimatter - cost.antimatter,
      darkMatter: state.resources.darkMatter - cost.darkMatter,
    },
    spaceships: [...state.spaceships, ship],
  };
}

// ─── UPGRADES ──────────────────────────────────────────

export function getUpgradeCost(
  type: SpaceshipType,
  currentLevel: number,
): Cost {
  const buildCost = BUILD_BASE_COSTS[type];
  return {
    food: Math.floor(buildCost.food * UPGRADE_BASE_RATIO * currentLevel),
    wood: Math.floor(buildCost.wood * UPGRADE_BASE_RATIO * currentLevel),
    stone: Math.floor(buildCost.stone * UPGRADE_BASE_RATIO * currentLevel),
    nectar: Math.floor(buildCost.nectar * UPGRADE_BASE_RATIO * currentLevel),
    voidCrystals: Math.floor(buildCost.voidCrystals * 2 * currentLevel),
    antimatter: Math.floor(buildCost.antimatter * 2 * currentLevel),
    darkMatter: Math.floor(buildCost.darkMatter * 2 * currentLevel),
  };
}

export function canUpgrade(
  spaceshipId: string,
  state: GameState,
): boolean {
  const ship = state.spaceships.find((s) => s.id === spaceshipId);
  if (!ship) return false;
  if (ship.level >= MAX_LEVEL) return false;

  const cost = getUpgradeCost(ship.type, ship.level);
  return (
    state.resources.food >= cost.food &&
    state.resources.wood >= cost.wood &&
    state.resources.stone >= cost.stone &&
    state.resources.nectar >= cost.nectar &&
    state.resources.voidCrystals >= cost.voidCrystals &&
    state.resources.antimatter >= cost.antimatter &&
    state.resources.darkMatter >= cost.darkMatter
  );
}

export function upgrade(
  spaceshipId: string,
  state: GameState,
): GameState {
  const idx = state.spaceships.findIndex((s) => s.id === spaceshipId);
  if (idx === -1) return state;

  const ship = state.spaceships[idx];
  if (ship.level >= MAX_LEVEL) return state;

  const cost = getUpgradeCost(ship.type, ship.level);
  if (
    state.resources.food < cost.food ||
    state.resources.wood < cost.wood ||
    state.resources.stone < cost.stone ||
    state.resources.nectar < cost.nectar ||
    state.resources.voidCrystals < cost.voidCrystals ||
    state.resources.antimatter < cost.antimatter ||
    state.resources.darkMatter < cost.darkMatter
  ) {
    return state;
  }

  const newLevel = ship.level + 1;
  const newMaxFuel = getFuelCapacity(ship.type, newLevel);

  const upgraded: Spaceship = {
    ...ship,
    level: newLevel,
    maxFuel: newMaxFuel,
    fuel: Math.min(ship.fuel, newMaxFuel),
  };

  return {
    ...state,
    resources: {
      ...state.resources,
      food: state.resources.food - cost.food,
      wood: state.resources.wood - cost.wood,
      stone: state.resources.stone - cost.stone,
      nectar: state.resources.nectar - cost.nectar,
      voidCrystals: state.resources.voidCrystals - cost.voidCrystals,
      antimatter: state.resources.antimatter - cost.antimatter,
      darkMatter: state.resources.darkMatter - cost.darkMatter,
    },
    spaceships: [
      ...state.spaceships.slice(0, idx),
      upgraded,
      ...state.spaceships.slice(idx + 1),
    ],
  };
}

// ─── FUEL ───────────────────────────────────────────────

export function getFuelCapacity(
  type: SpaceshipType,
  level: number,
): number {
  const cappedLevel = Math.min(level, MAX_LEVEL);
  return FUEL_BASE[type] + FUEL_PER_LEVEL[type] * (cappedLevel - 1);
}

const FUEL_PER_VOID_CRYSTAL = 1; // 1 voidCrystal = 1 fuel unit

export function refuel(
  spaceshipId: string,
  amount: number,
  state: GameState,
): GameState {
  if (amount <= 0) return state;

  const idx = state.spaceships.findIndex((s) => s.id === spaceshipId);
  if (idx === -1) return state;

  const ship = state.spaceships[idx];
  const spaceAvailable = ship.maxFuel - ship.fuel;
  if (spaceAvailable <= 0) return state;

  // Respect both available space and available voidCrystals
  const effectiveAmount = Math.min(amount, spaceAvailable, state.resources.voidCrystals);
  if (effectiveAmount <= 0) return state;

  const refueled: Spaceship = {
    ...ship,
    fuel: ship.fuel + effectiveAmount,
  };

  return {
    ...state,
    resources: {
      ...state.resources,
      voidCrystals: state.resources.voidCrystals - effectiveAmount,
    },
    spaceships: [
      ...state.spaceships.slice(0, idx),
      refueled,
      ...state.spaceships.slice(idx + 1),
    ],
  };
}

// ─── MISSIONS ──────────────────────────────────────────

function calculateMissionDistance(destination: string): number {
  const hash = destination.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 20 + (hash % 41); // 20 to 60 ticks
}

function calculateFuelCost(destination: string, shipType: SpaceshipType): number {
  const distance = calculateMissionDistance(destination);
  // Different ship types have different fuel efficiency
  const efficiency: Record<SpaceshipType, number> = {
    scout_ship: 1.0,
    cruiser: 0.7,
    capital_ship: 0.5,
  };
  return Math.max(10, Math.floor(distance * efficiency[shipType]));
}

export function launchMission(
  spaceshipId: string,
  destination: string,
  state: GameState,
): GameState {
  const idx = state.spaceships.findIndex((s) => s.id === spaceshipId);
  if (idx === -1) return state;

  const ship = state.spaceships[idx];
  if (ship.status !== 'idle') return state;

  const fuelCost = calculateFuelCost(destination, ship.type);
  if (ship.fuel < fuelCost) return state;

  const distance = calculateMissionDistance(destination);

  const launched: Spaceship = {
    ...ship,
    status: 'exploring',
    fuel: ship.fuel - fuelCost,
    missionTicksRemaining: distance,
    destinationName: destination,
  };

  return {
    ...state,
    spaceships: [
      ...state.spaceships.slice(0, idx),
      launched,
      ...state.spaceships.slice(idx + 1),
    ],
  };
}

export function tickMissions(state: GameState): GameState {
  let changed = false;
  const updated = state.spaceships.map((ship) => {
    if (ship.status === 'exploring' && ship.missionTicksRemaining > 0) {
      changed = true;
      const newTicks = ship.missionTicksRemaining - 1;
      const newStatus: SpaceshipStatus = newTicks <= 0 ? 'returning' : 'exploring';
      return {
        ...ship,
        missionTicksRemaining: newTicks,
        status: newStatus,
      };
    }
    return ship;
  });

  if (!changed) return state;
  return { ...state, spaceships: updated };
}

function generateLoot(
  destination: string,
  shipType: SpaceshipType,
  shipLevel: number,
): Partial<GameState['resources']> {
  const hash = destination.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const levelMultiplier = shipLevel;

  // Higher ship types get better loot
  const typeMultiplier: Record<SpaceshipType, number> = {
    scout_ship: 1,
    cruiser: 2,
    capital_ship: 4,
  };

  const base = typeMultiplier[shipType] * levelMultiplier;

  return {
    voidCrystals: Math.floor((5 + (hash % 10)) * base),
    antimatter: Math.floor((2 + (hash % 5)) * base),
    darkMatter: Math.floor((1 + (hash % 3)) * base),
  };
}

export function resolveMission(
  spaceshipId: string,
  state: GameState,
): GameState {
  const idx = state.spaceships.findIndex((s) => s.id === spaceshipId);
  if (idx === -1) return state;

  const ship = state.spaceships[idx];
  if (ship.status !== 'returning') return state;

  const loot = generateLoot(ship.destinationName, ship.type, ship.level);

  const returned: Spaceship = {
    ...ship,
    status: 'idle',
    missionTicksRemaining: 0,
    destinationName: '',
  };

  return {
    ...state,
    resources: {
      ...state.resources,
      voidCrystals: state.resources.voidCrystals + (loot.voidCrystals ?? 0),
      antimatter: state.resources.antimatter + (loot.antimatter ?? 0),
      darkMatter: state.resources.darkMatter + (loot.darkMatter ?? 0),
    },
    spaceships: [
      ...state.spaceships.slice(0, idx),
      returned,
      ...state.spaceships.slice(idx + 1),
    ],
  };
}
