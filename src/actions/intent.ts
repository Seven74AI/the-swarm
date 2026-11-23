import type { ActionIntent } from '../systems/NextAction';
import type { ActionResult } from './result';

/** The intents `perform` needs: a subset of the bound actions (see `createActions`). */
export interface IntentTargets {
  continuePhase(): ActionResult;
  assignWorker(role: Extract<ActionIntent, { role: unknown }>['role']): ActionResult;
  unassignWorker(role: Extract<ActionIntent, { role: unknown }>['role']): ActionResult;
  buyUpgrade(id: string): ActionResult;
  buyBuilding(id: Extract<ActionIntent, { action: 'buyBuilding' }>['id']): ActionResult;
  buyMutation(id: string): ActionResult;
  upgradeWeapon(): ActionResult;
  upgradeArmor(): ActionResult;
  buildShip(): ActionResult;
  upgradeShip(): ActionResult;
  buildParticleLab(): ActionResult;
  buyAutoDig(): ActionResult;
  startResearch(id: Extract<ActionIntent, { action: 'startResearch' }>['id']): ActionResult;
  researchAutomation(id: Extract<ActionIntent, { action: 'researchAutomation' }>['id']): ActionResult;
  buildAutomation(id: Extract<ActionIntent, { action: 'buildAutomation' }>['id']): ActionResult;
}

/**
 * Run a suggested intent (Story 1.21) through the action it names, so the
 * next-action button goes through the same validation, single write and
 * events as any other button.
 */
export function performIntent(actions: IntentTargets, intent: ActionIntent): ActionResult {
  switch (intent.action) {
    case 'continuePhase':
      return actions.continuePhase();
    case 'assignWorker':
      return actions.assignWorker(intent.role);
    case 'unassignWorker':
      return actions.unassignWorker(intent.role);
    case 'buyUpgrade':
      return actions.buyUpgrade(intent.id);
    case 'buyBuilding':
      return actions.buyBuilding(intent.id);
    case 'buyMutation':
      return actions.buyMutation(intent.id);
    case 'upgradeWeapon':
      return actions.upgradeWeapon();
    case 'upgradeArmor':
      return actions.upgradeArmor();
    case 'buildShip':
      return actions.buildShip();
    case 'upgradeShip':
      return actions.upgradeShip();
    case 'buildParticleLab':
      return actions.buildParticleLab();
    case 'buyAutoDig':
      return actions.buyAutoDig();
    case 'startResearch':
      return actions.startResearch(intent.id);
    case 'researchAutomation':
      return actions.researchAutomation(intent.id);
    case 'buildAutomation':
      return actions.buildAutomation(intent.id);
  }
}
