import type { ActionResult } from '../../actions';
import { getEffects } from '../../state/queries';
import { selectBuildings, selectFreeWorkers, selectResources, selectSoldiers } from '../../state/selectors';
import { recruitmentBalance as R } from '../../data/balance/recruitment';
import { formatFull } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Sep } from '../primitives/Deco';
import { AutomationRow, type AutomationRowActions } from '../shell/AutomationRow';

/** The actions RECRUIT calls (a subset of `Actions`). */
export interface RecruitActions extends AutomationRowActions {
  recruitScout(): ActionResult;
  recruitWarrior(): ActionResult;
}

const KINDS = [
  { verb: 'scout', kind: 'scouts', label: 'SCOUT', level: R.scoutBarracksLevel, cost: R.scoutFoodCost, cap: 'scoutsCap' },
  { verb: 'warrior', kind: 'warriors', label: 'WARRIOR', level: R.warriorBarracksLevel, cost: R.warriorFoodCost, cap: 'warriorsCap' },
] as const;

function RecruitRow({ item, actions }: { item: (typeof KINDS)[number]; actions: RecruitActions }) {
  const level = selectBuildings.value.barracks.level;
  const have = selectSoldiers.value[item.kind];
  const cap = getEffects('barracks', level)[item.cap] ?? 0;
  const food = selectResources.value.food;
  // The action's order (actions/combat.ts): barracks, cap, workers, food.
  const reason =
    level < item.level
      ? `needs Barracks level ${item.level}`
      : have >= cap
        ? 'barracks full'
        : selectFreeWorkers.value < 1
          ? 'no free workers'
          : food < item.cost
            ? `needs ${formatFull(item.cost - food)} more food`
            : false;
  return (
    <div class="recruit-row" data-recruit={item.verb}>
      <p class="war-line">
        {item.kind.toUpperCase()} {formatFull(have)} OF {formatFull(cap)}
      </p>
      <Button
        verb="RECRUIT"
        target={item.label}
        repeat
        onPress={item.verb === 'scout' ? actions.recruitScout : actions.recruitWarrior}
        disabled={reason}
        cost={
          <>
            {formatFull(item.cost)} FOOD
            <Sep />1 WORKER
          </>
        }
        data-action={`recruit-${item.verb}`}
      />
      <AutomationRow verb={item.verb} actions={actions} />
    </div>
  );
}

/**
 * RECRUIT on FRONT → MAP (Story 4.10): scouts and warriors for expeditions,
 * one free worker and its food each, within the barracks caps. Until now no
 * screen recruited them; the automation rows need the verb they take over.
 * Hooks: `[data-recruit=scout|warrior]`, `[data-action="recruit-scout"|"recruit-warrior"]`.
 */
export function RecruitSection({ actions }: { actions: RecruitActions }) {
  return (
    <section class="war-section recruit-section" data-war="recruit" aria-label="Recruit">
      <h2 class="panel-title">RECRUIT</h2>
      {KINDS.map((k) => (
        <RecruitRow key={k.verb} item={k} actions={actions} />
      ))}
    </section>
  );
}
