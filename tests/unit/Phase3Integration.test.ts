import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { createInitialState, TileType, type GameState } from '../../src/state/GameState';

/**
 * Phase 3 integration tests — behavior-focused.
 * Tests territory → resource pipeline without hardcoded values.
 */
describe('Phase 3 integration: discover → claim → bonuses', () => {
  let bus: EventBus;
  let resourceSystem: ResourceSystem;
  let mapSystem: MapSystem;
  let territory: TerritorySystem;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    resourceSystem = new ResourceSystem(bus);
    mapSystem = new MapSystem();
    territory = new TerritorySystem();
    state = createInitialState();
  });

  function setupHomeTile(): void {
    state.mapTiles[0] = { x: 0, y: 0, type: TileType.EMPTY, discovered: true, claimed: true };
    state.territory.ownedTiles = 1;
  }

  it('territory bonuses feed into resource tick', () => {
    setupHomeTile();
    // Discover and claim a FOREST tile
    mapSystem.discoverTile(state, 0, 1);
    state.mapTiles[1] = { ...state.mapTiles[1], type: TileType.FOREST };
    territory.claimTile(0, 1, state);

    state.resources.workers = 5;
    const bonuses = territory.getBonuses(state);
    const beforeFood = state.resources.food;

    const result = resourceSystem.tick(state, bonuses);
    // Bonuses should increase resources
    expect(result.resources.food).toBeGreaterThanOrEqual(beforeFood);
  });

  it('no claimed tiles = no bonuses', () => {
    setupHomeTile();
    state.resources.workers = 5;
    const bonuses = territory.getBonuses(state);
    const before = { ...state.resources };

    const result = resourceSystem.tick(state, bonuses);
    // Without claimed resource tiles, only food changes from workers
    expect(result.resources.stone).toBe(before.stone);
    expect(result.resources.nectar).toBe(before.nectar);
  });

  it('multiple tile types produce multiple resources', () => {
    setupHomeTile();
    // Claim a MOUNTAIN and a MEADOW
    mapSystem.discoverTile(state, 0, 1);
    state.mapTiles[1] = { ...state.mapTiles[1], type: TileType.MOUNTAIN };
    territory.claimTile(0, 1, state);

    mapSystem.discoverTile(state, 1, 0);
    state.mapTiles[8] = { ...state.mapTiles[8], type: TileType.MEADOW };
    territory.claimTile(1, 0, state);

    state.resources.workers = 5;

    let result = state;
    for (let i = 0; i < 5; i++) {
      const bonuses = territory.getBonuses(result);
      result = resourceSystem.tick(result, bonuses);
    }

    // After several ticks with workers, both resources should accumulate
    expect(result.resources.stone).toBeGreaterThan(0);
    expect(result.resources.nectar).toBeGreaterThan(0);
  });

  it('cannot claim undiscovered tile', () => {
    setupHomeTile();
    state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: false, claimed: false };
    expect(territory.claimTile(0, 1, state)).toBe(false);
  });

  it('discover then claim works', () => {
    setupHomeTile();
    state.mapTiles[8] = { x: 0, y: 1, type: TileType.FOREST, discovered: false, claimed: false };

    mapSystem.discoverTile(state, 0, 1);
    expect(territory.claimTile(0, 1, state)).toBe(true);
    expect(state.territory.ownedTiles).toBeGreaterThan(1);
  });
});
