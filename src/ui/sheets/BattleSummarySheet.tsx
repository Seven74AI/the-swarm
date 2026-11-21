import type { BattleOutcome, BattleResult } from '../../state/queries';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';
import { formatFull } from '../../utils/format';
import { Abbr, decorate } from '../primitives/Deco';
import { RESOURCE_BY_ID } from '../shell/resourceCatalog';
import '../war/war.css';

/**
 * The battle summary sheet (Story 1.25, UX-DR25 in part), opened at the
 * `battle` priority of the SheetController (Story 1.14) when a battle's
 * replay ends. Headline, losses, drops and the enemy. Story 4.3 adds the
 * cause line and `> CHANGE → <card>`. Hooks: `#battle-result`,
 * `[data-battle-summary][data-outcome]`, `[data-losses]`, `[data-drop=<id>]`.
 */

const HEADLINE: Record<BattleOutcome, string> = {
  victory: 'VICTORY',
  defeat: 'DEFEAT',
  draw: 'DRAW · THEY RETREATED.',
};

/** The resource the strip abbreviates, by its full name (UX-DR40). */
const nameOf = (id: string): string => RESOURCE_BY_ID[id as keyof typeof RESOURCE_BY_ID]?.name ?? id;

const DROPS = [
  { id: 'chitin', label: 'CHTN' },
  { id: 'silk', label: 'SILK' },
  { id: 'venom', label: 'VNOM' },
] as const;

export function BattleSummarySheet({ result, enemyName }: { result: BattleResult; enemyName: string }) {
  return (
    <ModalSheet
      headline={decorate(HEADLINE[result.outcome])}
      id="battle-result"
      class="battle-result"
      data-battle-summary=""
      data-outcome={result.outcome}
    >
      <ul class="battle-summary__lines">
        <li data-losses="">
          <span aria-hidden="true">▼ </span>SOLDIERS LOST −{formatFull(result.soldiersLost)}
        </li>
        {result.foodGained > 0 && <li data-drop="food">FOOD +{formatFull(result.foodGained)}</li>}
        {DROPS.filter((d) => result.specialLoot[d.id] > 0).map((d) => (
          <li key={d.id} data-drop={d.id}>
            <Abbr shown={d.label} full={nameOf(d.id)} /> +{formatFull(result.specialLoot[d.id])}
          </li>
        ))}
        <li data-enemy="">ENEMY {enemyName.toUpperCase()}</li>
      </ul>
    </ModalSheet>
  );
}

/** Request the battle summary sheet; returns its sheet id. */
export function openBattleSummary(sheets: SheetController, result: BattleResult, enemyName: string): number {
  return sheets.open({ priority: 'battle', render: () => <BattleSummarySheet result={result} enemyName={enemyName} /> });
}
