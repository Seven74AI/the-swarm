/**
 * Player intents (AR22). Every button the player presses calls one of these.
 * An action validates against the current state, writes the new state once
 * between ticks and returns `{ ok: true }`, or returns `{ ok: false, reason }`
 * and leaves the state untouched. Events it raises go out after its write.
 *
 * `createActions` binds them to the systems built at boot; the UI receives
 * the resulting `Actions` object and never touches a system itself.
 */
import type { ActionDeps } from './context';
import type { WorkerRole } from '../systems/ResourceSystem';
import type { MoveSource } from '../systems/Workforce';
import type { RoomSlot } from '../systems/RoomJobs';
import type { RoleId } from '../data/content/roles';
import type { BuildingType } from '../systems/BuildingSystem';
import type { AutomationBuildingType, ResearchType } from '../systems/AutomationSystem';
import type { ResearchProjectId } from '../state/GameState';
import type { PrestigeUpgradeId } from '../data/prestigeTree';
import type { Phase } from '../phases/phases';
import * as nest from './nest';
import * as buildings from './buildings';
import * as research from './research';
import * as combat from './combat';
import * as expansion from './expansion';
import * as space from './space';
import * as prestige from './prestige';
import { chooseDecision } from './decisions';
import { setAutomation, setAutomationTarget } from './automation';
import type { AutomationVerb } from '../data/content/automation';
import { continuePhase, markRevealSeen } from './phase';
import { performIntent } from './intent';
import type { ActionIntent } from '../systems/NextAction';

export type { ActionDeps } from './context';
export type { ActionResult, RefusalReason, Refused, StateStore } from './result';
export { REFUSAL_REASONS } from './result';

export function createActions(deps: ActionDeps) {
  const actions = {
    // Nest
    layEgg: () => nest.layEgg(deps),
    dig: () => nest.dig(deps),
    feed: () => nest.feed(deps),
    buyAutoDig: () => nest.buyAutoDig(deps),
    setRoomJob: (from: RoomSlot, to: RoomSlot) => nest.setRoomJob(deps, from, to),
    markResourcesSeen: (ids: readonly string[]) => nest.markResourcesSeen(deps, ids),
    assignWorker: (role: WorkerRole) => nest.assignWorker(deps, role),
    unassignWorker: (role: WorkerRole) => nest.unassignWorker(deps, role),
    stepRole: (role: RoleId, delta: number) => nest.stepRole(deps, role, delta),
    moveWorkers: (from: MoveSource, to: RoleId, count: number) => nest.moveWorkers(deps, from, to, count),
    buyUpgrade: (upgradeId: string) => nest.buyUpgrade(deps, upgradeId),
    // Buildings and automation
    buyBuilding: (type: BuildingType) => buildings.buyBuilding(deps, type),
    researchAutomation: (id: ResearchType) => buildings.researchAutomation(deps, id),
    buildAutomation: (id: AutomationBuildingType) => buildings.buildAutomation(deps, id),
    setAutoProduction: (enabled: boolean) => buildings.setAutoProduction(deps, enabled),
    // Automation targets (Story 4.10)
    setAutomationTarget: (verb: AutomationVerb, target: number) => setAutomationTarget(deps, verb, target),
    setAutomation: (verb: AutomationVerb, on: boolean) => setAutomation(deps, verb, on),
    // Research and conversions
    assignResearcher: () => research.assignResearcher(deps),
    unassignResearcher: () => research.unassignResearcher(deps),
    startResearch: (id: ResearchProjectId) => research.startResearch(deps, id),
    cancelResearch: (id: ResearchProjectId) => research.cancelResearch(deps, id),
    runConversions: () => research.runConversions(deps),
    buildParticleLab: () => research.buildParticleLab(deps),
    // Combat
    trainSoldier: () => combat.trainSoldier(deps),
    upgradeWeapon: () => combat.upgradeWeapon(deps),
    upgradeArmor: () => combat.upgradeArmor(deps),
    fight: (enemyType?: string) => combat.fight(deps, enemyType),
    buyMutation: (id: string) => combat.buyMutation(deps, id),
    recruitScout: () => combat.recruitScout(deps),
    recruitWarrior: () => combat.recruitWarrior(deps),
    // Expansion
    startExpedition: (scouts: number, warriors: number, destination: string) =>
      expansion.startExpedition(deps, scouts, warriors, destination),
    claimTile: (x: number, y: number) => expansion.claimTile(deps, x, y),
    // Space
    buildShip: () => space.buildShip(deps),
    upgradeShip: () => space.upgradeShip(deps),
    launchProbe: (destination: string) => space.launchProbe(deps, destination),
    // Prestige
    prestige: () => prestige.prestige(deps),
    buyPrestigeUpgrade: (id: PrestigeUpgradeId) => prestige.buyPrestigeUpgrade(deps, id),
    // Phase flow
    continuePhase: () => continuePhase(deps),
    markRevealSeen: (phase: Phase) => markRevealSeen(deps, phase),
    // Decisions
    chooseDecision: (choice: string) => chooseDecision(deps, choice),
  };
  return {
    ...actions,
    /** Run a next-action suggestion (Story 1.21) through the action it names. */
    perform: (intent: ActionIntent) => performIntent(actions, intent),
  };
}

/** Every player intent, bound to the game's systems. */
export type Actions = ReturnType<typeof createActions>;
