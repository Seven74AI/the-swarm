import { Phase } from '../../phases/phases';
import { FIRST_PRODUCED_IN } from './producers';
import { ROLES } from './roles';
import { PANEL_PLACEMENT } from './tabs';

/**
 * Decision events as data (Story 1.28, D8, N3; the GM-2 events converted).
 *
 * Each event declares the phases it can spawn in, an ignore policy, an
 * optional timer, the `IGNORE: <outcome>` line, exactly two choices and, for a
 * costly ignore, what ignoring costs.
 * - `free`: ignoring (or the timer running out) changes nothing.
 * - `costly`: ignoring applies `ignore`; the timeout is logged and toasted.
 * - `unavoidable`: no timer, no dismiss; one of the two choices must be taken.
 *
 * Outcomes are declarative `DecisionEffect`s, applied by
 * `systems/DecisionSystem.applyChoice`. A `risk` uses the roll drawn when the
 * event spawned (kept in the save), so the outcome of a choice is fixed once
 * the event is on screen: closing the app and coming back can't reroll it.
 *
 * UI text is upper case (the terminal look); `costLine` is the visible cost or
 * risk under each choice.
 */

export type DecisionId =
  | 'cold_snap'
  | 'fallen_seed'
  | 'flooded_chamber'
  | 'beetle_sighting'
  | 'overcrowding'
  | 'aphids'
  | 'wounded_return'
  | 'shed_shells'
  | 'envoy'
  | 'scout_report';
export type IgnorePolicy = 'free' | 'costly' | 'unavoidable';

/**
 * The stocks a decision outcome can change (Story 4.5). `eggs` and `larvae`
 * move their pipeline's count with them; `guards` are workers on the guard
 * role; `soldiers` are the combat soldiers; `scouts` the recruited scouts.
 */
export type DecisionStock =
  | 'food'
  | 'workers'
  | 'nestCapacity'
  | 'eggs'
  | 'larvae'
  | 'wood'
  | 'stone'
  | 'nectar'
  | 'guards'
  | 'soldiers'
  | 'chitin'
  | 'scouts';

export interface DecisionStockDef {
  /** Upper case, as the sheet names it (`NEEDS 2 GUARDS`). */
  readonly name: string;
  /** One of it (`−1 WORKER`). */
  readonly one: string;
  /** The first phase the stock exists in: an event may name or change it only from then on. */
  readonly firstIn: Phase;
}

const roleOpens = (id: string): Phase => ROLES.find((r) => r.id === id)!.unlockPhase;

/**
 * Each decision stock's sheet name and the phase it first exists in, derived
 * from the producer table, the role table and the panel placements, so an
 * event can't name or take a stock before the player has one (catch-22,
 * Story 3.6; UX-DR42: nothing names a later phase).
 */
export const DECISION_STOCKS: Readonly<Record<DecisionStock, DecisionStockDef>> = {
  food: { name: 'FOOD', one: 'FOOD', firstIn: FIRST_PRODUCED_IN.food },
  workers: { name: 'WORKERS', one: 'WORKER', firstIn: FIRST_PRODUCED_IN.workers },
  nestCapacity: { name: 'CAPACITY', one: 'CAPACITY', firstIn: Phase.EGG_LAYING },
  eggs: { name: 'EGGS', one: 'EGG', firstIn: Phase.EGG_LAYING },
  larvae: { name: 'LARVAE', one: 'LARVA', firstIn: Phase.EGG_LAYING },
  wood: { name: 'WOOD', one: 'WOOD', firstIn: FIRST_PRODUCED_IN.wood },
  stone: { name: 'STONE', one: 'STONE', firstIn: FIRST_PRODUCED_IN.stone },
  nectar: { name: 'NECTAR', one: 'NECTAR', firstIn: FIRST_PRODUCED_IN.nectar },
  guards: { name: 'GUARDS', one: 'GUARD', firstIn: roleOpens('guard') },
  soldiers: { name: 'SOLDIERS', one: 'SOLDIER', firstIn: PANEL_PLACEMENT.soldier_panel.unlockPhase },
  chitin: { name: 'CHITIN', one: 'CHITIN', firstIn: FIRST_PRODUCED_IN.chitin },
  scouts: { name: 'SCOUTS', one: 'SCOUT', firstIn: PANEL_PLACEMENT.expedition_panel.unlockPhase },
};

export type DecisionEffect =
  /** Add (or, negative, remove) a whole amount; never below 0. */
  | { readonly kind: 'add'; readonly stock: DecisionStock; readonly amount: number }
  /** Lose a share of a stock, floored. */
  | { readonly kind: 'lose_percent'; readonly stock: DecisionStock; readonly percent: number }
  /** Discover up to `count` undiscovered map tiles, nearest the nest first. */
  | { readonly kind: 'reveal_tiles'; readonly count: number };

export interface DecisionChoiceDef {
  readonly id: string;
  /** Button verb, e.g. `COLLECT`. */
  readonly label: string;
  /** The visible cost or risk, e.g. `+15 FOOD · 1 IN 2: −1 WORKER`. */
  readonly costLine: string;
  readonly effects: readonly DecisionEffect[];
  /** Applied too when the spawn roll falls under `chance` (0–1). */
  readonly risk?: { readonly chance: number; readonly effects: readonly DecisionEffect[] };
  /** The choice can't be taken without this much of a stock. */
  readonly requires?: { readonly stock: DecisionStock; readonly amount: number };
}

export interface DecisionDef {
  readonly id: DecisionId;
  readonly phases: readonly Phase[];
  readonly ignorePolicy: IgnorePolicy;
  /** Countdown in game-time ms (free and costly only). */
  readonly timerMs?: number;
  /**
   * When the event may spawn, beyond its phase: `crowded` waits for a nest
   * near its capacity (`decisionBalance.crowdedShare`).
   */
  readonly spawnsWhen?: 'crowded';
  /** The event's name, upper case with a full stop (`OVERCROWDING.`, UX-DR42). */
  readonly title: string;
  /** The situation. */
  readonly situation: string;
  /** What ignoring means, shown as `IGNORE: <ignoreLine>`. */
  readonly ignoreLine: string;
  readonly choices: readonly [DecisionChoiceDef, DecisionChoiceDef];
  /** What a costly ignore costs. */
  readonly ignore?: readonly DecisionEffect[];
}

const TIMER_MS = 30_000;

/**
 * Story 4.5 (FR13, FR14): three events unique to each MVP phase, each with an
 * ignore policy (EXPERIENCE Flow 4: Beetle Sighting is costly, OVERCROWDING.
 * unavoidable). The pillar each serves and why neither choice is strictly
 * dominated is in the story's PR. Scout Report stays the Expansion and Space event.
 */
export const DECISIONS: readonly DecisionDef[] = [
  // ─── Egg Laying ──────────────────────────────────────────────────────────
  {
    id: 'cold_snap',
    phases: [Phase.EGG_LAYING],
    ignorePolicy: 'costly',
    timerMs: TIMER_MS,
    title: 'COLD SNAP.',
    situation: 'THE NIGHT TURNS COLD. THE EGGS AT THE EDGE OF THE BROOD STOP MOVING.',
    ignoreLine: 'THE COLD TAKES 25% OF THE EGGS',
    choices: [
      {
        id: 'warm',
        label: 'WARM THE BROOD',
        costLine: '−10 FOOD · THE EGGS LIVE',
        requires: { stock: 'food', amount: 10 },
        effects: [{ kind: 'add', stock: 'food', amount: -10 }],
      },
      {
        id: 'carry',
        label: 'CARRY THEM DEEPER',
        costLine: '−10% EGGS · NO FOOD SPENT',
        effects: [{ kind: 'lose_percent', stock: 'eggs', percent: 10 }],
      },
    ],
    ignore: [{ kind: 'lose_percent', stock: 'eggs', percent: 25 }],
  },
  {
    id: 'fallen_seed',
    phases: [Phase.EGG_LAYING],
    ignorePolicy: 'free',
    timerMs: TIMER_MS,
    title: 'A FALLEN SEED.',
    situation: 'A SEED DROPS INTO THE TUNNEL. IT IS HEAVY, AND IT IS FOOD.',
    ignoreLine: 'NOTHING HAPPENS',
    choices: [
      {
        id: 'drag',
        label: 'DRAG IT IN',
        costLine: '+25 FOOD · 1 IN 3: −1 WORKER',
        effects: [{ kind: 'add', stock: 'food', amount: 25 }],
        risk: { chance: 1 / 3, effects: [{ kind: 'add', stock: 'workers', amount: -1 }] },
      },
      {
        id: 'eat',
        label: 'EAT IT WHERE IT LIES',
        costLine: '+8 FOOD · NO RISK',
        effects: [{ kind: 'add', stock: 'food', amount: 8 }],
      },
    ],
  },
  {
    id: 'flooded_chamber',
    phases: [Phase.EGG_LAYING],
    ignorePolicy: 'unavoidable',
    title: 'FLOODED CHAMBER.',
    situation: 'RAIN SEEPS INTO THE NEST. THE LOWEST CHAMBER, WHERE THE LARVAE LIE, FILLS WITH WATER.',
    ignoreLine: 'NOT POSSIBLE. THE WATER KEEPS RISING',
    choices: [
      {
        id: 'bail',
        label: 'BAIL IT OUT',
        costLine: '−15 FOOD · THE LARVAE LIVE',
        requires: { stock: 'food', amount: 15 },
        effects: [{ kind: 'add', stock: 'food', amount: -15 }],
      },
      {
        id: 'drain',
        label: 'LET IT DRAIN',
        costLine: '−30% LARVAE',
        effects: [{ kind: 'lose_percent', stock: 'larvae', percent: 30 }],
      },
    ],
  },
  // ─── Colony ──────────────────────────────────────────────────────────────
  {
    id: 'beetle_sighting',
    phases: [Phase.COLONY],
    ignorePolicy: 'costly',
    timerMs: TIMER_MS,
    title: 'BEETLE SIGHTING.',
    situation: 'A BEETLE PROWLS AT THE ENTRANCE. THE WORKERS OUTSIDE ARE IN ITS PATH.',
    ignoreLine: 'THE BEETLE TAKES 3 WORKERS',
    choices: [
      {
        id: 'send_guards',
        label: 'SEND GUARDS',
        costLine: '+60 FOOD · 1 IN 2: −2 GUARDS',
        requires: { stock: 'guards', amount: 2 },
        effects: [{ kind: 'add', stock: 'food', amount: 60 }],
        risk: { chance: 0.5, effects: [{ kind: 'add', stock: 'guards', amount: -2 }] },
      },
      {
        id: 'seal',
        label: 'SEAL THE ENTRANCE',
        costLine: '−10% FOOD · −10% WOOD · NO RISK',
        effects: [
          { kind: 'lose_percent', stock: 'food', percent: 10 },
          { kind: 'lose_percent', stock: 'wood', percent: 10 },
        ],
      },
    ],
    ignore: [{ kind: 'add', stock: 'workers', amount: -3 }],
  },
  {
    id: 'overcrowding',
    phases: [Phase.COLONY],
    ignorePolicy: 'unavoidable',
    spawnsWhen: 'crowded',
    title: 'OVERCROWDING.',
    situation: 'THE NEST IS CRAMPED. WORKERS CLIMB OVER EACH OTHER AND THE STORES ARE TRAMPLED.',
    ignoreLine: 'NOT POSSIBLE. THE NEST MUST MAKE ROOM',
    choices: [
      {
        id: 'expand',
        label: 'EXPAND',
        costLine: '−100 STONE · +10 CAPACITY',
        requires: { stock: 'stone', amount: 100 },
        effects: [
          { kind: 'add', stock: 'stone', amount: -100 },
          { kind: 'add', stock: 'nestCapacity', amount: 10 },
        ],
      },
      {
        id: 'exile',
        label: 'EXILE',
        costLine: '−10% WORKERS',
        effects: [{ kind: 'lose_percent', stock: 'workers', percent: 10 }],
      },
    ],
  },
  {
    id: 'aphids',
    phases: [Phase.COLONY],
    ignorePolicy: 'free',
    timerMs: TIMER_MS,
    title: 'APHIDS ON THE STEM.',
    situation: 'A STEM BY THE NEST IS THICK WITH APHIDS. THEIR HONEYDEW IS SWEET, AND ANTS FROM ANOTHER NEST WANT IT TOO.',
    ignoreLine: 'NOTHING HAPPENS',
    choices: [
      {
        id: 'herd',
        label: 'HERD THEM',
        costLine: '+40 NECTAR · 1 IN 3: −2 WORKERS',
        effects: [{ kind: 'add', stock: 'nectar', amount: 40 }],
        risk: { chance: 1 / 3, effects: [{ kind: 'add', stock: 'workers', amount: -2 }] },
      },
      {
        id: 'milk',
        label: 'TAKE A LITTLE',
        costLine: '+10 NECTAR · NO RISK',
        effects: [{ kind: 'add', stock: 'nectar', amount: 10 }],
      },
    ],
  },
  // ─── Combat ──────────────────────────────────────────────────────────────
  {
    id: 'wounded_return',
    phases: [Phase.COMBAT],
    ignorePolicy: 'costly',
    timerMs: TIMER_MS,
    title: 'THE WOUNDED RETURN.',
    situation: 'SOLDIERS LIMP HOME FROM THE LAST FIGHT. THEY NEED FOOD AND REST TO HEAL.',
    ignoreLine: '10% OF THE SOLDIERS DIE OF THEIR WOUNDS',
    choices: [
      {
        id: 'nurse',
        label: 'NURSE THEM',
        costLine: '−15% FOOD · THE SOLDIERS LIVE',
        effects: [{ kind: 'lose_percent', stock: 'food', percent: 15 }],
      },
      {
        id: 'retire',
        label: 'SEND THEM TO WORK',
        costLine: '−3 SOLDIERS · +3 WORKERS',
        requires: { stock: 'soldiers', amount: 3 },
        effects: [
          { kind: 'add', stock: 'soldiers', amount: -3 },
          { kind: 'add', stock: 'workers', amount: 3 },
        ],
      },
    ],
    ignore: [{ kind: 'lose_percent', stock: 'soldiers', percent: 10 }],
  },
  {
    id: 'shed_shells',
    phases: [Phase.COMBAT],
    ignorePolicy: 'free',
    timerMs: TIMER_MS,
    title: 'SHELLS ON THE FIELD.',
    situation: 'THE LAST FIGHT LEAVES SHELLS ON THE FIELD. THE ENEMY STILL WATCHES IT.',
    ignoreLine: 'NOTHING HAPPENS',
    choices: [
      {
        id: 'strip',
        label: 'STRIP THE FIELD',
        costLine: '+6 CHITIN · 1 IN 2: −2 SOLDIERS',
        effects: [{ kind: 'add', stock: 'chitin', amount: 6 }],
        risk: { chance: 0.5, effects: [{ kind: 'add', stock: 'soldiers', amount: -2 }] },
      },
      {
        id: 'near',
        label: 'TAKE WHAT IS CLOSE',
        costLine: '+2 CHITIN · NO RISK',
        effects: [{ kind: 'add', stock: 'chitin', amount: 2 }],
      },
    ],
  },
  {
    id: 'envoy',
    phases: [Phase.COMBAT],
    ignorePolicy: 'unavoidable',
    title: 'AN ENVOY ARRIVES.',
    situation: 'AN ENEMY ENVOY WAITS AT THE ENTRANCE. IT ASKS FOR FOOD, OR ITS ARMY RAIDS THE NEST.',
    ignoreLine: 'NOT POSSIBLE. THE ENVOY WAITS FOR AN ANSWER',
    choices: [
      {
        id: 'pay',
        label: 'PAY TRIBUTE',
        costLine: '−20% FOOD · NO RAID',
        effects: [{ kind: 'lose_percent', stock: 'food', percent: 20 }],
      },
      {
        id: 'refuse',
        label: 'REFUSE',
        costLine: 'NOTHING PAID · 1 IN 2: −20% SOLDIERS',
        effects: [],
        risk: { chance: 0.5, effects: [{ kind: 'lose_percent', stock: 'soldiers', percent: 20 }] },
      },
    ],
  },
  // ─── Expansion and Space ─────────────────────────────────────────────────
  {
    id: 'scout_report',
    phases: [Phase.EXPANSION, Phase.SPACE],
    ignorePolicy: 'unavoidable',
    title: 'SCOUT REPORT.',
    situation: 'SCOUTS SAW MOVEMENT BEYOND THE MAPPED GROUND. SOMETHING IS OUT THERE, AND IT HAS SEEN THEM TOO.',
    ignoreLine: 'NOT POSSIBLE. THE SCOUTS WAIT FOR AN ORDER',
    choices: [
      {
        id: 'investigate',
        label: 'INVESTIGATE',
        costLine: 'UP TO 3 TILES · 1 IN 2: −1 SCOUT',
        effects: [{ kind: 'reveal_tiles', count: 3 }],
        risk: { chance: 0.5, effects: [{ kind: 'add', stock: 'scouts', amount: -1 }] },
      },
      {
        id: 'stay_hidden',
        label: 'STAY HIDDEN',
        costLine: 'NOTHING FOUND · NO RISK',
        effects: [],
      },
    ],
  },
];

export const DECISION_IDS: readonly DecisionId[] = DECISIONS.map((d) => d.id);

const BY_ID = new Map<string, DecisionDef>(DECISIONS.map((d) => [d.id, d]));

export function isDecisionId(id: unknown): id is DecisionId {
  return typeof id === 'string' && BY_ID.has(id);
}

/** The event with this id; throws on an unknown one (a typo is a bug, not a state). */
export function getDecision(id: DecisionId): DecisionDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown decision event: ${String(id)}`);
  return def;
}

/** The log line and toast for a costly timeout (Story 1.28): what ignoring cost. */
export function timeoutLine(def: DecisionDef): string {
  return `${def.title.replace(/\.$/, '')} IGNORED: ${def.ignoreLine}.`;
}
