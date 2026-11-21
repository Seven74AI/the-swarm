import type { ReadonlySignal } from '@preact/signals-core';
import { AutomationRow, type AutomationRowActions } from '../shell/AutomationRow';
import type { ActionResult } from '../../actions';
import type { SegmentId } from '../../data/content/tabs';
import {
  selectBattlesLost,
  selectBattlesWon,
  selectBuildings,
  selectCombatResources,
  selectCombatSoldiers,
  selectEquipment,
  selectArmyUpkeepPerSec,
  selectFreeWorkers,
  selectLastBattle,
  selectMatchup,
  selectMutationStatus,
  selectResources,
  selectSoldierDefense,
  selectSoldierMaxHp,
  selectSoldierPipeline,
  selectSoldierSpeed,
  selectSoldierStrength,
  selectStarving,
} from '../../state/selectors';
import { soldierBalance } from '../../data/balance/soldiers';
import { TRAITS } from '../../data/content/enemies';
import { combatBalance } from '../../data/balance/combat';
import {
  MUTATIONS,
  marksOf,
  type CounterMarks,
  getEnemyDefs,
  getEquipmentUpgradeCost,
  type BattleOutcome,
  type Matchup,
  type MutationCost,
  type MutationDef,
} from '../../state/queries';
import { formatFull } from '../../utils/format';
import type { ComponentChildren } from 'preact';
import { Abbr, Sep } from '../primitives/Deco';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { Meter } from '../primitives/Meter';
import type { WarSession } from './warSession';
import './war.css';

/** The actions WAR uses (a subset of `Actions`). */
export interface WarActions extends AutomationRowActions {
  trainSoldier(): ActionResult;
  upgradeWeapon(): ActionResult;
  upgradeArmor(): ActionResult;
  buyMutation(id: string): ActionResult;
}

const upper = (s: string) => s.toUpperCase();

/** Drop names as the strip labels them (resourceCatalog: CHTN, SILK, VNOM). */
const DROPS = [
  { id: 'chitin', label: 'CHTN', name: 'chitin' },
  { id: 'silk', label: 'SILK', name: 'silk' },
  { id: 'venom', label: 'VNOM', name: 'venom' },
] as const;

/** `5 CHTN · 5 SILK`, read "5 chitin, 5 silk" (UX-DR40). */
function costLine(cost: MutationCost): ComponentChildren {
  return DROPS.filter((d) => cost[d.id] > 0).map((d, i) => (
    <span key={d.id}>
      {i > 0 && <Sep />}
      {formatFull(cost[d.id])} <Abbr shown={d.label} full={d.name} />
    </span>
  ));
}

/** Soldier and enemy stats with their full names for assistive tech: `STR 3 · DEF 1 · HP 15`. */
const STAT_NAMES = { STR: 'strength', DEF: 'defense', SPD: 'speed', HP: 'hit points' } as const;
function Stats({ values }: { values: readonly (readonly [keyof typeof STAT_NAMES, number])[] }) {
  return (
    <>
      {values.map(([stat, v], i) => (
        <span key={stat}>
          {i > 0 && <Sep />}
          <Abbr shown={stat} full={STAT_NAMES[stat]} /> {formatFull(v)}
        </span>
      ))}
    </>
  );
}

/** The first drop the player is short of, as `needs 3 more chitin`, or null. */
function shortOf(cost: MutationCost, have: MutationCost): { amount: number; name: string } | null {
  for (const d of DROPS) {
    if (have[d.id] < cost[d.id]) return { amount: Math.floor(cost[d.id] - have[d.id]), name: d.name };
  }
  return null;
}

// --- Soldiers and training, equipment -------------------------------------------------------

/** A food rate, floored to hundredths below 10 (`0.75`, `5.25`) and to whole units above (Story 4.4). */
function formatUpkeep(perSec: number): string {
  if (perSec >= 10) return formatFull(Math.floor(perSec));
  return String(Math.floor(perSec * 100) / 100);
}

/** `5.25 FOOD/S`, read "5.25 food a second". */
function FoodRate({ perSec }: { perSec: number }) {
  return (
    <>
      {formatUpkeep(perSec)} <Abbr shown="FOOD/S" full="food a second" />
    </>
  );
}

function TrainingLine() {
  const pipe = selectSoldierPipeline.value;
  const training = pipe.count;
  const pct = Math.floor(Math.min(1, Math.max(0, pipe.progress)) * 100);
  return (
    <>
      <p class="war-line">
        <span data-soldiers="">SOLDIERS {formatFull(selectCombatSoldiers.value)}</span>
        <Sep />
        {/* What the army eats, trainees included (Story 4.4, FR12). */}
        <span data-army-upkeep="">
          UPKEEP <FoodRate perSec={selectArmyUpkeepPerSec.value} />
        </span>
        <Sep />
        <span data-training="">TRAINING {formatFull(training)}</span>
      </p>
      {training > 0 && (
        <Meter label="Training"
          value={pct}
          max={100}
          valueText={`Training ${training} soldier${training === 1 ? '' : 's'}, next ${pct}% done`}
          class="war-training"
        />
      )}
    </>
  );
}

function StatsLine() {
  return (
    <p class="war-line war-dim" data-soldier-stats="">
      <Stats
        values={[
          ['STR', selectSoldierStrength.value],
          ['DEF', selectSoldierDefense.value],
          ['SPD', selectSoldierSpeed.value],
          ['HP', selectSoldierMaxHp.value],
        ]}
      />
    </p>
  );
}

function TrainButton({ actions }: { actions: WarActions }) {
  const free = selectFreeWorkers.value;
  const food = selectResources.value.food;
  const workers = combatBalance.army.workersPerSoldier;
  // The action's order (actions/combat.ts): workers, starving (Story 4.4), then food.
  const reason =
    free < workers
      ? 'no free workers'
      : selectStarving.value
        ? 'the colony is starving'
        : food < soldierBalance.costFood
          ? `needs ${formatFull(soldierBalance.costFood - food)} more food`
          : false;
  return (
    <Button
      verb="TRAIN"
      target="SOLDIER"
      repeat
      onPress={actions.trainSoldier}
      disabled={reason}
      cost={
        <>
          {formatFull(soldierBalance.costFood)} FOOD
          <Sep />
          {formatFull(workers)} WORKER{workers === 1 ? '' : 'S'}
          <Sep />
          UPKEEP <FoodRate perSec={combatBalance.army.upkeepFoodPerSec} />
        </>
      }
      data-action="train-soldier"
    />
  );
}

/** What an upgrade counters, after its effect (Story 4.2): `+1 STR · BEST AGAINST THICK SHELL, WEB`. */
function withCounters(effect: string, marks: CounterMarks): string {
  if (marks.strongAgainst.length === 0) return effect;
  return `${effect} · BEST AGAINST ${marks.strongAgainst.map((t) => TRAITS[t].label).join(', ')}`;
}

/** The effect of the next level (`combatBalance.equipment`; level is 0-based here). */
function equipmentEffect(id: 'weapon' | 'armor', level: number): string {
  if (id === 'weapon') {
    const next = combatBalance.equipment.weapon[level];
    return next ? `+${next.strength} STR` : '';
  }
  const next = combatBalance.equipment.armor[level];
  return next ? `+${next.defense} DEF AND +${next.maxHp} HP` : '';
}

const EQUIPMENT = [
  { id: 'weapon', title: 'WEAPONS', pool: 'chitin', label: 'CHTN', building: 'chitin_armory', buildingName: 'Chitin Armory' },
  { id: 'armor', title: 'ARMOR', pool: 'silk', label: 'SILK', building: 'silk_weaving', buildingName: 'Silk Weaving' },
] as const;

function EquipmentCard({ item, actions }: { item: (typeof EQUIPMENT)[number]; actions: WarActions }) {
  const level = selectEquipment.value[item.id];
  const built = (selectBuildings.value[item.building]?.level ?? 0) >= 1;
  const have = selectCombatResources.value[item.pool];
  const max = level >= soldierBalance.maxEquipmentLevel;
  const cost = max ? 0 : getEquipmentUpgradeCost(level);
  const affordable = !max && built && have >= cost;
  const reason = max
    ? 'max level'
    : !built
      ? `needs ${item.buildingName}`
      : have < cost
        ? `needs ${formatFull(cost - have)} more ${item.pool}`
        : false;
  return (
    <Card
      id={`equipment-${item.id}`}
      title={item.title}
      level={max ? `LV ${level} · MAX` : `LV ${level} → ${level + 1}`}
      effect={max ? 'AT ITS LAST LEVEL' : withCounters(equipmentEffect(item.id, level), marksOf({ kind: 'equipment', id: item.id, level: level + 1 }))}
      cost={
        max ? undefined : (
          <>
            {formatFull(cost)} <Abbr shown={item.label} full={item.pool} />
            <Sep />
            you have {formatFull(have)}
          </>
        )
      }
      affordable={affordable}
      shortfall={built && !max && have < cost ? { amount: cost - have } : null}
      action={
        <Button
          verb="UPGRADE"
          target={item.title}
          onPress={item.id === 'weapon' ? actions.upgradeWeapon : actions.upgradeArmor}
          disabled={reason}
          data-action={`upgrade-${item.id}`}
        />
      }
    />
  );
}

/** Soldiers, training and equipment, in `#soldier-panel` (replaces SoldierPanel). */
export function SoldiersSection({ actions }: { actions: WarActions }) {
  return (
    <div class="war-section" data-war="soldiers">
      <h2 class="panel-title">SOLDIERS</h2>
      <TrainingLine />
      <StatsLine />
      <TrainButton actions={actions} />
      {/* Under TRAIN once training can be automated (Story 4.10): KEEP [−] N [+] IN TRAINING [AUTO]. */}
      <AutomationRow verb="train" actions={actions} />
      <div class="panel-subtitle">EQUIPMENT</div>
      {EQUIPMENT.map((e) => (
        <EquipmentCard key={e.id} item={e} actions={actions} />
      ))}
    </div>
  );
}

// --- Mutations -------------------------------------------------------------------------------

function MutationCard({ def, actions }: { def: MutationDef; actions: WarActions }) {
  const status = selectMutationStatus(def.id).value;
  const have = selectCombatResources.value;
  const short = status === 'short' ? shortOf(def.cost, have) : null;
  const pre = def.prerequisite ? MUTATIONS.find((m) => m.id === def.prerequisite) : undefined;
  const action =
    status === 'owned' ? (
      <span class="war-status" data-mutation-status="owned">
        ACQUIRED ✓
      </span>
    ) : (
      <>
        {status === 'locked' && (
          <span class="war-status war-dim" data-mutation-status="locked">
            REQUIRES {upper(pre?.name ?? def.prerequisite ?? '')}
          </span>
        )}
        <Button
          verb="BUY"
          target={upper(def.name)}
          onPress={() => actions.buyMutation(def.id)}
          disabled={
            status === 'locked'
              ? `needs ${pre?.name ?? def.prerequisite} first`
              : short
                ? `needs ${formatFull(short.amount)} more ${short.name}`
                : false
          }
          data-action="buy-mutation"
        />
      </>
    );
  return (
    <div id={`mutation-card-${def.id}`} class="mutation-card" data-mutation={def.id} data-status={status}>
      <Card
        id={`mutation-${def.id}`}
        title={upper(def.name)}
        effect={withCounters(upper(def.description), marksOf({ kind: 'mutation', id: def.id }))}
        cost={status === 'owned' ? undefined : costLine(def.cost)}
        affordable={status === 'affordable'}
        shortfall={short ? { amount: short.amount } : null}
        action={action}
      />
    </div>
  );
}

/** One card per mutation, in `#mutation-panel` (replaces MutationPanel; keeps `#mutation-card-<id>`). */
export function MutationsSection({ actions }: { actions: WarActions }) {
  return (
    <div class="war-section" data-war="mutations">
      <h2 class="panel-title">MUTATIONS</h2>
      <div class="mutation-grid" id="mutation-grid">
        {MUTATIONS.map((m) => (
          <MutationCard key={m.id} def={m} actions={actions} />
        ))}
      </div>
    </div>
  );
}

// --- The enemy card --------------------------------------------------------------------------

const MATCHUP_LINE: Record<Matchup, string> = {
  favoured: 'WE OUTMATCH THEM.',
  even: 'AN EVEN FIGHT.',
  dangerous: 'THEY LOOK DANGEROUS.',
};

/**
 * The enemy card, in `#battle-panel` (replaces BattlePanel): the enemy `> FIGHT`
 * fights with its trait (`ARMORED BEETLE · THICK SHELL`, Story 4.1) and what
 * the trait does, a read of the matchup, the record, and a round counter while
 * a battle runs (UX-DR26).
 */
export function EnemyCard({ session }: { session: WarSession }) {
  const enemy = session.enemy.value;
  const battle = session.battle.value;
  const matchup = selectMatchup.value;
  const trait = TRAITS[enemy.trait];
  return (
    <div class="war-section" data-war="enemy" data-enemy={enemy.type} data-trait={enemy.trait}>
      <h2 class="panel-title">ENEMY</h2>
      <Card
        id="enemy"
        title={
          <>
            <span id="enemy-name">{upper(enemy.name)}</span>
            <Sep />
            <span data-enemy-trait={enemy.trait}>{trait.label}</span>
          </>
        }
        effect={
          <>
            <span class="war-trait-line" data-trait-line="">
              {trait.line}
            </span>{' '}
            <span data-matchup={matchup} id="enemy-comparison">
              {MATCHUP_LINE[matchup]}
            </span>
          </>
        }
        cost={
          <Stats
            values={[
              ['STR', enemy.strength],
              ['DEF', enemy.defense],
              ['HP', enemy.hp],
            ]}
          />
        }
        affordable
        action={null}
      >
        {battle.status === 'running' && (
          // Not a live region: rounds tick fast; the result is announced once (Story 1.32).
          <p class="war-round" data-round={battle.round}>
            ROUND {battle.round}
          </p>
        )}
      </Card>
      <p class="war-line war-dim" data-record="">
        WON {formatFull(selectBattlesWon.value)}
        <Sep />
        LOST {formatFull(selectBattlesLost.value)}
      </p>
    </div>
  );
}

// --- The combat log --------------------------------------------------------------------------

const OUTCOME: Record<BattleOutcome, string> = { victory: 'VICTORY', defeat: 'DEFEAT', draw: 'DRAW' };

const enemyName = (type: string) => upper(getEnemyDefs().find((e) => e.type === type)?.name ?? type);

function BattleLine(props: { outcome: BattleOutcome; enemy: string; lost: number; food: number; newest: boolean }) {
  return (
    <li class="war-log-line" data-battle-line={props.outcome} data-newest={props.newest ? '' : undefined}>
      <span aria-hidden="true">{props.newest ? '> ' : '· '}</span>
      {OUTCOME[props.outcome]}
      <Sep />
      {props.enemy}
      <Sep />−{formatFull(props.lost)} SOLDIERS
      {props.food > 0 && (
        <>
          <Sep />+{formatFull(props.food)} FOOD
        </>
      )}
    </li>
  );
}

/**
 * The combat log, in `#combat-log-panel` (replaces CombatLogPanel): this
 * session's battles, newest first, or the saved last battle after a reload.
 */
export function CombatLog({ session }: { session: WarSession }) {
  const history = session.history.value;
  const last = selectLastBattle.value;
  return (
    <div class="war-section" data-war="log">
      <h2 class="panel-title">COMBAT LOG</h2>
      {history.length > 0 ? (
        <ul class="war-log">
          {history.map((b, i) => (
            <BattleLine
              key={i}
              outcome={b.result.outcome}
              enemy={upper(b.enemy.name)}
              lost={b.result.soldiersLost}
              food={b.result.foodGained}
              newest={i === 0}
            />
          ))}
        </ul>
      ) : last.status === 'done' ? (
        <ul class="war-log">
          <BattleLine
            outcome={last.result}
            enemy={enemyName(last.enemyType)}
            lost={last.soldiersLost}
            food={last.foodGained}
            newest
          />
        </ul>
      ) : (
        <p class="war-line war-dim" data-empty="">
          NO BATTLES YET.
        </p>
      )}
    </div>
  );
}

// --- The primary action ----------------------------------------------------------------------

/**
 * FRONT's primary action in the WAR segment (UX-DR26): `> FIGHT <enemy>`,
 * disabled with `train soldiers first` when there are no soldiers. MAP and
 * STARS get their own primary actions in Epic 6.
 */
export function WarPrimary({ session, segment }: { session: WarSession; segment: ReadonlySignal<SegmentId | null> }) {
  if (segment.value !== 'war') return null;
  const soldiers = selectCombatSoldiers.value;
  const running = session.battle.value.status === 'running';
  const enemy = session.enemy.value;
  return (
    <div class="war-primary" data-war-primary="">
      <Button
        variant="primary"
        verb="FIGHT"
        target={upper(enemy.name)}
        id="engage-battle"
        onPress={() => session.fight()}
        disabled={soldiers <= 0 ? 'train soldiers first' : running ? 'battle running' : false}
        cost={`${formatFull(soldiers)} SOLDIERS`}
        data-action="fight"
      />
    </div>
  );
}
