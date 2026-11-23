import type { GameState } from '../state/GameState';
import { itemCost, itemTarget, listItems } from './NextAction';
import { roleBalance } from '../data/balance/roles';
import { digBalance } from '../data/balance/dig';
import { soldierBalance } from '../data/balance/soldiers';

/**
 * Where a resource comes from and what spends it (Story 9.10, the resource
 * sheet's peek), from the data the systems use: the role yields, DIG's stone,
 * the soldier price, and every item on sale now priced in it. Upper case, one
 * entry each. Pure.
 */
export interface ResourceFlows {
  readonly from: readonly string[];
  readonly spentOn: readonly string[];
}

/** What brings each resource in, keyed by resource; a yield of 0 drops its entry. */
function sources(): Readonly<Record<string, readonly string[]>> {
  const yes = (n: number, text: string) => (n > 0 ? [text] : []);
  return {
    eggs: ['THE QUEEN: LAY EGG, OR THE BROOD TARGET ON AUTO'],
    larvae: ['EGGS THAT HATCH'],
    workers: ['LARVAE THAT MATURE, OR FED INTO A FREE ROOM'],
    food: [...yes(roleBalance.gatherFoodPerSec, 'GATHERERS'), ...yes(roleBalance.idleFoodPerSec, 'IDLE WORKERS')],
    wood: [...yes(roleBalance.gatherWoodPerSec, 'GATHERERS'), 'FOREST TERRITORY'],
    stone: [...yes(roleBalance.digStonePerSec, 'DIGGERS'), ...yes(digBalance.pointsPerStone, 'DIG PRESSES'), 'MOUNTAIN TERRITORY'],
    nectar: [...yes(roleBalance.forageNectarPerSec, 'FORAGERS'), 'MEADOW TERRITORY'],
    silk: ['BATTLE LOOT'],
    chitin: ['BATTLE LOOT', 'THE MIDDEN'],
    venom: ['BATTLE LOOT'],
    voidCrystals: ['THE CONVERTER: STONE AND NECTAR', 'EXPEDITIONS'],
    antimatter: ['THE CONVERTER: VOID CRYSTALS', 'EXPEDITIONS'],
    darkMatter: ['THE CONVERTER: ANTIMATTER', 'EXPEDITIONS'],
    surveyData: ['SPACE EXPLORATIONS'],
  };
}

/** Standing spends that are not items: upkeep, the pipelines, soldiers. */
function upkeep(id: string): string[] {
  switch (id) {
    case 'food':
      return ['EATEN BY WORKERS AND SOLDIERS', ...(soldierBalance.costFood > 0 ? ['TRAINING SOLDIERS'] : [])];
    case 'eggs':
      return ['HATCHING INTO LARVAE'];
    case 'larvae':
      return ['MATURING INTO WORKERS'];
    case 'workers':
      return ['TRAINING SOLDIERS', 'RESEARCH'];
    default:
      return [];
  }
}

export function resourceFlows(s: GameState, id: string): ResourceFlows {
  const items = listItems()
    .filter((ref) => (itemCost(s, ref)?.[id as keyof NonNullable<ReturnType<typeof itemCost>>] ?? 0) > 0)
    .map((ref) => itemTarget(s, ref));
  return { from: sources()[id] ?? [], spentOn: [...new Set([...upkeep(id), ...items])] };
}
