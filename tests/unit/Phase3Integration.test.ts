import { describe, it, expect, beforeEach } from 'vitest';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, TileType, type GameState } from '../../src/state/GameState';

describe('Phase 3 integration: discover → claim → bonuses', () => {
  let mapSystem: MapSystem;
  let territory: TerritorySystem;
  let resourceSystem: ResourceSystem;
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    mapSystem = new MapSystem();
    territory = new TerritorySystem();
    bus = new EventBus();
    resourceSystem = new ResourceSystem(bus);
    state = createInitialState();
  });

  /**
   * Set up a home tile at (0,0) so we can claim adjacent tiles.
   */
  function setupHomeTile() {
    state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
    state.territory.ownedTiles = 1;
  }

  it('discovers a FOREST tile and food bonus applies on tick', () => {
    setupHomeTile();
    // Place a FOREST tile at (0,1)
    state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: false, claimed: false };

    // 1. Discover tile
    const discovered = mapSystem.discoverTile(state, 0, 1);
    expect(discovered).toBe(true);
    expect(state.mapTiles[8].discovered).toBe(true);

    // 2. Claim tile
    const claimed = territory.claimTile(0, 1, state);
    expect(claimed).toBe(true);
    expect(state.mapTiles[8].claimed).toBe(true);

    // 3. Get bonuses
    const bonuses = territory.getBonuses(state);
    expect(bonuses.food).toBeCloseTo(0.5);
    expect(bonuses.stone).toBe(0);
    expect(bonuses.nectar).toBe(0);

    // 4. Apply tick with bonuses
    state.resources.workers = 10;
    state.resources.food = 100;

    const result = resourceSystem.tick(state, bonuses);
    // Normal: 10 produced, 5 consumed = +5 net. Bonus: 10 × 0.1 = +1. Total: 100 + 5 + 1 = 106
    expect(result.resources.food).toBeCloseTo(110);
  });

  it('discovers MOUNTAIN tile and stone bonus applies on tick', () => {
    setupHomeTile();
    state.mapTiles[8] = { x: 0, y: 1, type: TileType.MOUNTAIN, discovered: false, claimed: false };

    mapSystem.discoverTile(state, 0, 1);
    territory.claimTile(0, 1, state);

    const bonuses = territory.getBonuses(state);
    expect(bonuses.stone).toBeCloseTo(0.5);

    state.resources.workers = 5;
    const result = resourceSystem.tick(state, bonuses);
    expect(result.resources.stone).toBeCloseTo(2); // 5 × 0.5
  });

  it('discovers MEADOW tile and nectar bonus applies on tick', () => {
    setupHomeTile();
    state.mapTiles[8] = { x: 0, y: 1, type: TileType.MEADOW, discovered: false, claimed: false };

    mapSystem.discoverTile(state, 0, 1);
    territory.claimTile(0, 1, state);

    const bonuses = territory.getBonuses(state);
    expect(bonuses.nectar).toBeCloseTo(0.5);

    state.resources.workers = 4;
    const result = resourceSystem.tick(state, bonuses);
    expect(result.resources.nectar).toBeCloseTo(2.0); // 4 × 0.5
  });

  it('multiple tile claims accumulate bonuses over ticks', () => {
    setupHomeTile();

    // Claim a chain: (0,1)=FOREST, (0,2)=FOREST, (1,1)=MOUNTAIN
    state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: false, claimed: false };
    state.mapTiles[16] = { x: 0, y: 2, type: TileType.FOREST, discovered: false, claimed: false };
    state.mapTiles[9] = { x: 1, y: 1, type: TileType.MOUNTAIN, discovered: false, claimed: false };

    mapSystem.discoverTile(state, 0, 1);
    territory.claimTile(0, 1, state);

    mapSystem.discoverTile(state, 0, 2);
    territory.claimTile(0, 2, state);

    mapSystem.discoverTile(state, 1, 1);
    territory.claimTile(1, 1, state);

    const bonuses = territory.getBonuses(state);
    expect(bonuses.food).toBeCloseTo(1.0);   // 2 FOREST
    expect(bonuses.stone).toBeCloseTo(0.5);  // 1 MOUNTAIN

    // Tick 1
    state.resources.workers = 10;
    state.resources.food = 0;

    let result = resourceSystem.tick(state, bonuses);
    expect(result.resources.food).toBeCloseTo(15); // 5 regular + 10 bonus = 15
    expect(result.resources.stone).toBeCloseTo(5.0);  // 10 × 0.5

    // Tick 2: accumulate resources
    result = resourceSystem.tick(result, bonuses);
    // 1st tick: food=0 + 10 - 5 + 10 = 15
    // 2nd tick: food=15 + 10 - 5 + 10 = 30
    expect(result.resources.food).toBeCloseTo(30);
    expect(result.resources.stone).toBeCloseTo(10.0); // 5.0 + 5.0
  });

  it('cannot claim undiscovered tile (integration guard)', () => {
    setupHomeTile();
    state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: false, claimed: false };

    // Try to claim without discovering first
    const claimed = territory.claimTile(0, 1, state);
    expect(claimed).toBe(false);

    // Discover then claim
    mapSystem.discoverTile(state, 0, 1);
    expect(territory.claimTile(0, 1, state)).toBe(true);
  });

  it('bonuses are zero with no claimed resource tiles', () => {
    setupHomeTile();
    // Home tile is EMPTY — no bonuses
    const bonuses = territory.getBonuses(state);
    expect(bonuses.food).toBe(0);
    expect(bonuses.stone).toBe(0);
    expect(bonuses.nectar).toBe(0);

    state.resources.workers = 10;
    state.resources.food = 100;
    const result = resourceSystem.tick(state, bonuses);
    // Only normal food production
    expect(result.resources.food).toBeCloseTo(105);
    expect(result.resources.stone).toBe(0);
    expect(result.resources.nectar).toBe(0);
  });
});
