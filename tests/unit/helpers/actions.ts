import { EventBus } from '../../../src/engine/EventBus';
import { createActions, type Actions, type StateStore } from '../../../src/actions';
import type { GameState } from '../../../src/state/GameState';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { BattleSystem } from '../../../src/systems/BattleSystem';
import { DecisionSystem } from '../../../src/systems/DecisionSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';

/**
 * Real actions for a panel test. Pass `get`/`set` to keep the state in a test
 * variable; leave them out to use the `gameState` signal.
 */
export function testActions(
  bus: EventBus = new EventBus(),
  get?: () => GameState,
  set?: (s: GameState) => void,
): Actions {
  const store: StateStore | undefined = get && set ? { get, set } : undefined;
  return createActions({
    bus,
    resourceSystem: new ResourceSystem(bus),
    soldierSystem: new SoldierSystem(bus),
    battleSystem: new BattleSystem(bus),
    decisionSystem: new DecisionSystem(bus),
    territorySystem: new TerritorySystem(),
    store,
  });
}
