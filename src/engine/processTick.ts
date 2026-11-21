import type { GameState } from '../state/GameState';
import type { EventSink } from './events';
import type { ResourceSystem } from '../systems/ResourceSystem';
import type { SoldierSystem } from '../systems/SoldierSystem';
import type { MapSystem } from '../systems/MapSystem';
import type { TerritorySystem } from '../systems/TerritorySystem';
import { tickExpeditions, resolveExpedition } from '../systems/ExpeditionSystem';
import { tickExplorations, resolveExploration, tickProbeSwarm } from '../systems/ExplorationSystem';
import { tickResearch } from '../systems/ResearchSystem';
import { tickConversions } from '../systems/ResourceConversionSystem';
import { tickEntropy } from '../systems/EntropySystem';
import { tickMissions, resolveMission } from '../systems/SpaceshipSystem';
import { tickAutoProduction } from './AutoProductionLoop';
import { rngStream, type RngStream } from '../utils/rng';
import { MS_PER_SEC } from '../data/constants';
import { resourceBalance } from '../data/balance/resources';

/**
 * Advance the simulation by one step of `dtSec` (Story 2.5, AR4): the live
 * tick (main's `step`, 50 ms) and offline catch-up both run it. Every system
 * here gives the same result for one long step as for many short ones, within
 * the tolerance stated in `tests/unit/engine/stepLength.test.ts`.
 * Pure: events go to `events`, the state is returned, nothing is written.
 *
 * Randomness (Story 3.1, ADR 0005): shared draws (the map) come from `rng`,
 * the tick context's stream (live) or a stream opened on `state.rng`
 * (catch-up), and the returned state carries its advanced state. Timed
 * outcomes (expeditions, explorations, probe launches) use keyed streams, so
 * they draw per game time, not per call, and step length can't change them.
 */
export function processTick(
  state: GameState,
  resourceSystem: ResourceSystem,
  soldierSystem: SoldierSystem,
  mapSystem: MapSystem,
  territorySystem: TerritorySystem,
  events: EventSink,
  dtSec: number,
  skipDeterministicResources: boolean = false,
  rng: RngStream = rngStream(state.rng),
): GameState {
  let workingState = state;

  // Generate map if tiles are all empty
  if (state.mapTiles.length > 0 && state.mapTiles.every((t) => t.type === 'empty' && !t.discovered)) {
    workingState = mapSystem.generateMap(workingState, undefined, rng);
  }

  const bonuses = territorySystem.getBonuses(workingState);
  let newState = resourceSystem.tick(workingState, bonuses, dtSec, skipDeterministicResources, events);

  // Track gross food produced for prestige system
  // Skip when using closed-form offline computation (already counted above)
  if (!skipDeterministicResources) {
    const pWorkers = workingState.resources.workers;
    const pAssigned = workingState.workersAssigned;
    const pGatherCount = pAssigned.gather;
    const pUnassignedCount = pWorkers - pGatherCount - pAssigned.tend - pAssigned.dig - pAssigned.guard;
    const pBaseFoodProduced = pGatherCount * resourceBalance.gatherFoodPerSec + Math.max(0, pUnassignedCount) * resourceBalance.idleFoodPerSec;
    const pTerritoryFood = Math.floor(pWorkers * (bonuses.food ?? 0));
    const pGrossFoodProduced = (pBaseFoodProduced + pTerritoryFood) * dtSec;
    newState = {
      ...newState,
      prestige: {
        ...newState.prestige,
        totalFoodProduced: newState.prestige.totalFoodProduced + pGrossFoodProduced,
      },
    };
  }

  newState = soldierSystem.tick(newState, dtSec, events);
  // Automation and the prestige auto egg layer: whole eggs, into the egg pipeline.
  newState = tickAutoProduction(newState, dtSec);

  // Expedition system: tick timers and resolve completed ones
  newState = tickExpeditions(newState, dtSec);
  for (const exp of newState.expeditions) {
    if (exp.remainingMs <= 0) {
      newState = resolveExpedition(newState, exp);
      // Emit expedition return event with result details
      const totalSent = exp.scouts + exp.warriors;
      const scoutsReturned = Math.min(exp.scouts, Math.max(0, newState.soldiers.scouts - (workingState.soldiers.scouts - exp.scouts)));
      const warriorsReturned = Math.min(exp.warriors, Math.max(0, newState.soldiers.warriors - (workingState.soldiers.warriors - exp.warriors)));

      let result: 'success' | 'partial' | 'failure' = 'failure';
      if (scoutsReturned + warriorsReturned === totalSent) {
        result = 'success';
      } else if (scoutsReturned + warriorsReturned > 0) {
        result = 'partial';
      }

      const oldResources = workingState.resources;
      events.emit('expedition_return', {
        destination: exp.destination,
        result,
        food: newState.resources.food - oldResources.food,
        stone: newState.resources.stone - oldResources.stone,
        nectar: newState.resources.nectar - oldResources.nectar,
        wood: newState.resources.wood - oldResources.wood,
        scoutsReturned,
        warriorsReturned,
        tilesDiscovered: newState.territory.ownedTiles - workingState.territory.ownedTiles,
      });
      workingState = newState;
    }
  }

  // Space exploration system: tick timers and resolve completed ones
  newState = tickExplorations(newState, dtSec);
  for (const exp of newState.spaceExplorations) {
    if (exp.remainingMs <= 0) {
      newState = resolveExploration(newState, exp);
      // Emit exploration return event with result details
      const oldResources = workingState.resources;
      let result: 'success' | 'partial' | 'failure' = 'success';
      if (newState.resources.voidCrystals === oldResources.voidCrystals &&
          newState.resources.antimatter === oldResources.antimatter &&
          newState.resources.darkMatter === oldResources.darkMatter) {
        result = 'failure';
      } else if (newState.resources.voidCrystals + newState.resources.antimatter + newState.resources.darkMatter <
                 oldResources.voidCrystals + oldResources.antimatter + oldResources.darkMatter + 1) {
        result = 'partial';
      }
      events.emit('exploration_return', {
        destination: exp.destination,
        result,
        voidCrystals: newState.resources.voidCrystals - oldResources.voidCrystals,
        antimatter: newState.resources.antimatter - oldResources.antimatter,
        darkMatter: newState.resources.darkMatter - oldResources.darkMatter,
      });
      workingState = newState;
    }
  }

  // Probe Swarm: auto-launch explorations when enough surveyData accumulated
  newState = tickProbeSwarm(newState, dtSec);
  workingState = newState;

  // Spaceship system: tick missions and resolve returning ones
  newState = tickMissions(newState, dtSec);
  for (const ship of newState.spaceships) {
    if (ship.status === 'returning') {
      const oldVoidCrystals = newState.resources.voidCrystals;
      const oldAntimatter = newState.resources.antimatter;
      const oldDarkMatter = newState.resources.darkMatter;
      newState = resolveMission(ship.id, newState);
      events.emit('spaceship_return', {
        shipId: ship.id,
        destination: ship.destinationName,
        shipType: ship.type,
        shipLevel: ship.level,
        voidCrystals: newState.resources.voidCrystals - oldVoidCrystals,
        antimatter: newState.resources.antimatter - oldAntimatter,
        darkMatter: newState.resources.darkMatter - oldDarkMatter,
      });
      workingState = newState;
    }
  }

  // Tick research progress
  newState = tickResearch(newState, dtSec);

  // Resource conversions
  newState = tickConversions(newState, dtSec);

  // Entropy accumulation (GM-10)
  newState = tickEntropy(newState, dtSec);

  // Advance playTimeMs
  newState = {
    ...newState,
    rng: rng.state,
    stats: {
      ...newState.stats,
      playTimeMs: newState.stats.playTimeMs + (dtSec * MS_PER_SEC),
    },
  };

  return newState;
}
