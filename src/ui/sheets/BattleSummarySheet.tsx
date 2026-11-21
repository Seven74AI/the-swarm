import { useContext } from 'preact/hooks';
import { causeLine, type BattleAdvice, type BattleOutcome, type BattleResult, type CounterCard } from '../../state/queries';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet, SheetContext } from '../shell/Sheet';
import { Button } from '../primitives/Button';
import { formatFull } from '../../utils/format';
import { Abbr, decorate } from '../primitives/Deco';
import { RESOURCE_BY_ID } from '../shell/resourceCatalog';
import '../war/war.css';

/**
 * The battle summary sheet (Story 1.25, UX-DR25 in part), opened at the
 * `battle` priority of the SheetController (Story 1.14) when a battle's
 * replay ends. Headline, losses, drops and the enemy, then one cause line
 * (Story 4.3, `[data-cause=<kind>]`) and, after a defeat or a draw,
 * `> CHANGE → <card>` (`button[data-action="change"][data-counter=<key>]`):
 * the card `counterFor(cause)` returns, with its shortfall on the cost line
 * when the colony cannot pay for it, and a cheaper counter it can pay for
 * (`[data-counter-alt=<key>]`) when one exists. Hooks: `#battle-result`,
 * `[data-battle-summary][data-outcome]`, `[data-losses]`, `[data-drop=<id>]`.
 */

export interface BattleSummaryOptions {
  /** What the summary points at (`battleAdvice(result.cause, state)`), read when the sheet opens. */
  readonly advice?: BattleAdvice;
  /** `> CHANGE` was pressed (the sheet is closed first): open that card. */
  readonly onChange?: (card: CounterCard) => void;
}

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

function Change({ advice, onChange }: { advice: BattleAdvice; onChange: (card: CounterCard) => void }) {
  const { close } = useContext(SheetContext);
  const counter = advice.counter!;
  const short = advice.shortfall;
  return (
    <Button
      variant="primary"
      verb="CHANGE"
      target={`→ ${counter.target}`}
      cost={short ? `needs ${formatFull(short.amount)} more ${nameOf(short.resource).toLowerCase()}` : undefined}
      onPress={() => {
        close();
        onChange(counter);
      }}
      data-action="change"
      data-counter={counter.key}
    />
  );
}

export function BattleSummarySheet({
  result,
  enemyName,
  advice,
  onChange,
}: { result: BattleResult; enemyName: string } & BattleSummaryOptions) {
  const change = result.outcome !== 'victory' && advice?.counter && onChange ? advice : null;
  const alt = change?.alternative ?? null;
  return (
    <ModalSheet
      action={change && onChange ? <Change advice={change} onChange={onChange} /> : undefined}
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
      <p class="battle-summary__cause" data-cause={result.cause.kind}>
        {causeLine(result.cause)}
      </p>
      {alt && (
        <p class="battle-summary__alt war-dim" data-counter-alt={alt.key}>
          {decorate(`CHEAPER NOW → ${alt.target}`)}
        </p>
      )}
    </ModalSheet>
  );
}

/** Request the battle summary sheet; returns its sheet id. */
export function openBattleSummary(
  sheets: SheetController,
  result: BattleResult,
  enemyName: string,
  options: BattleSummaryOptions = {},
): number {
  return sheets.open({ priority: 'battle', render: () => <BattleSummarySheet result={result} enemyName={enemyName} {...options} /> });
}
