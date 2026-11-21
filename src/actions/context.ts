import type { EventBus } from '../engine/EventBus';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { BattleSystem } from '../systems/BattleSystem';
import type { DecisionSystem } from '../systems/DecisionSystem';
import type { TerritorySystem } from '../systems/TerritorySystem';
import type { StateStore } from './result';

/** What actions need from boot: the bus for their events and the stateful systems. */
export interface ActionDeps {
  bus: EventBus;
  resourceSystem: ResourceSystem;
  soldierSystem: SoldierSystem;
  battleSystem: BattleSystem;
  decisionSystem: DecisionSystem;
  territorySystem: TerritorySystem;
  /** Defaults to the `gameState` signal. */
  store?: StateStore;
}
