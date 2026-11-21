import type { EventBus } from '../engine/EventBus';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { BattleSystem } from '../systems/BattleSystem';
import type { DecisionSystem } from '../systems/DecisionSystem';
import type { TerritorySystem } from '../systems/TerritorySystem';
import type { StateStore } from './result';
import type { PhaseStateMachine } from '../phases/PhaseStateMachine';

/** What actions need from boot: the bus for their events and the stateful systems. */
export interface ActionDeps {
  bus: EventBus;
  resourceSystem: ResourceSystem;
  soldierSystem: SoldierSystem;
  battleSystem: BattleSystem;
  decisionSystem: DecisionSystem;
  territorySystem: TerritorySystem;
  /** The phase flow CONTINUE commits through. Defaults to one built on `TRANSITIONS`. */
  phases?: PhaseStateMachine;
  /** Defaults to the `gameState` signal. */
  store?: StateStore;
}
