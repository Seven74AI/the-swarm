import { describe, it, expect, beforeEach } from 'vitest';
import { Phase } from '../../../src/phases/phases';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { affordableKeys } from '../../../src/state/affordances';
import { gameState } from '../../../src/state/gameSignal';
import { selectAffordableKeys } from '../../../src/state/selectors';
import { MUTATIONS } from '../../../src/systems/MutationSystem';
import { getBuildCost } from '../../../src/systems/BuildingSystem';

/** A state rich enough to afford anything. */
function rich(): GameState {
  const s = createInitialState();
  const lots = 10 ** 9;
  return {
    ...s,
    // Colony: the first phase with buildings (Story 3.5).
    phase: Phase.COLONY,
    resources: { ...s.resources, food: lots, wood: lots, stone: lots, nectar: lots },
    combatResources: { ...s.combatResources, chitin: lots, silk: lots, venom: lots },
  };
}

describe('affordableKeys (Story 1.15: the tab dot)', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });

  it('lists an affordable building under the building panel, and drops it when unaffordable', () => {
    const s = rich();
    expect(affordableKeys(s)).toContain('building_panel:warehouse');

    const cost = getBuildCost('warehouse', s.buildings.warehouse.level + 1);
    const poor: GameState = {
      ...s,
      resources: { ...s.resources, food: cost.food - 1 < 0 ? 0 : cost.food - 1, wood: 0, stone: 0, nectar: 0 },
      combatResources: { ...s.combatResources, chitin: 0, silk: 0, venom: 0 },
    };
    expect(affordableKeys(poor)).not.toContain('building_panel:warehouse');
  });

  it('lists affordable Click Power under BUILD\'s Click Power card (Story 1.24)', () => {
    expect(affordableKeys(rich())).toContain('build_click_power:click_power');
    const s = rich();
    expect(affordableKeys({ ...s, resources: { ...s.resources, food: 0 } })).not.toContain('build_click_power:click_power');
  });

  it('lists purchasable mutations under the mutation panel', () => {
    const first = MUTATIONS.find((m) => !m.prerequisite)!;
    expect(affordableKeys(rich())).toContain(`mutation_panel:${first.id}`);
    expect(affordableKeys(createInitialState())).not.toContain(`mutation_panel:${first.id}`);
  });

  it('every key is "<panelId>:<item>" and keys are unique', () => {
    const keys = affordableKeys(rich());
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k).toMatch(/^[a-z_]+:.+$/);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('selectAffordableKeys is a primitive, so a tick that changes nothing affordable keeps it equal', () => {
    gameState.value = rich();
    const before = selectAffordableKeys.value;
    expect(typeof before).toBe('string');
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: gameState.value.resources.food + 1 } };
    expect(selectAffordableKeys.value).toBe(before);
  });
});
