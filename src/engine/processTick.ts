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
import { getPrestigeBonuses } from '../systems/PrestigeBonusSystem';

/**
 * Process a single tick for offline catch-up simulation.
 * Extracted so it can be reused by the main tick loop and offline processing.
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
): GameState {
  let workingState = state;

  // Generate map if tiles are all empty
  if (state.mapTiles.length > 0 && state.mapTiles.every((t) => t.type === 'empty' && !t.discovered)) {
    workingState = mapSystem.generateMap(workingState);
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
    const pBaseFoodProduced = pGatherCount * 2 + Math.max(0, pUnassignedCount) * 1;
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
  newState = tickAutoProduction(newState, dtSec);

  // Auto-egg-layer from prestige tree (1 egg/sec)
  const pBonuses = getPrestigeBonuses(newState);
  if (pBonuses.autoEggLayer) {
    newState = {
      ...newState,
      resources: {
        ...newState.resources,
        eggs: newState.resources.eggs + dtSec,
      },
      stats: {
        ...newState.stats,
        totalEggsLaid: newState.stats.totalEggsLaid + dtSec,
      },
      eggPipeline: {
        ...newState.eggPipeline,
        count: newState.eggPipeline.count + dtSec,
      },
    };
  }

  // Tick expedition timers
  newState = tickExpeditions(newState, dtSec);
  for (const exp of newState.expeditions) {
    if (exp.remainingMs <= 0) {
      newState = resolveExpedition(newState, exp);
    }
  }

  // Tick space exploration timers
  newState = tickExplorations(newState, dtSec);
  for (const exp of newState.spaceExplorations) {
    if (exp.remainingMs <= 0) {
      newState = resolveExploration(newState, exp);
    }
  }

  // Probe Swarm: auto-launch explorations when enough surveyData accumulated
  newState = tickProbeSwarm(newState);

  // Tick spaceship missions
  newState = tickMissions(newState);
  for (const ship of newState.spaceships) {
    if (ship.status === 'returning') {
      newState = resolveMission(ship.id, newState);
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
    stats: {
      ...newState.stats,
      playTimeMs: newState.stats.playTimeMs + (dtSec * 1000),
    },
  };

  return newState;
}
