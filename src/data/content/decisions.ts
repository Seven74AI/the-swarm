import { Phase } from '../../phases/phases';

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

export type DecisionId = 'beetle_sighting' | 'overcrowding' | 'scout_report';
export type IgnorePolicy = 'free' | 'costly' | 'unavoidable';

/** The resources a decision outcome can change. */
export type DecisionResource = 'food' | 'workers' | 'nestCapacity';

export type DecisionEffect =
  /** Add (or, negative, remove) a whole amount; never below 0. */
  | { readonly kind: 'add'; readonly resource: DecisionResource; readonly amount: number }
  /** Lose a share of a resource, floored. */
  | { readonly kind: 'lose_percent'; readonly resource: DecisionResource; readonly percent: number }
  /** Discover up to `count` undiscovered map tiles, nearest the nest first. */
  | { readonly kind: 'reveal_tiles'; readonly count: number }
  /** Lose scouts (never below 0). */
  | { readonly kind: 'lose_scouts'; readonly count: number };

export interface DecisionChoiceDef {
  readonly id: string;
  /** Button verb, e.g. `COLLECT`. */
  readonly label: string;
  /** The visible cost or risk, e.g. `+15 FOOD · 1 IN 2: −1 WORKER`. */
  readonly costLine: string;
  readonly effects: readonly DecisionEffect[];
  /** Applied too when the spawn roll falls under `chance` (0–1). */
  readonly risk?: { readonly chance: number; readonly effects: readonly DecisionEffect[] };
  /** The choice can't be taken without this much of a resource. */
  readonly requires?: { readonly resource: DecisionResource; readonly amount: number };
}

export interface DecisionDef {
  readonly id: DecisionId;
  readonly phases: readonly Phase[];
  readonly ignorePolicy: IgnorePolicy;
  /** Countdown in game-time ms (free and costly only). */
  readonly timerMs?: number;
  readonly title: string;
  /** The situation. */
  readonly situation: string;
  /** What ignoring means, shown as `IGNORE: <ignoreLine>`. */
  readonly ignoreLine: string;
  readonly choices: readonly [DecisionChoiceDef, DecisionChoiceDef];
  /** What a costly ignore costs. */
  readonly ignore?: readonly DecisionEffect[];
}

const COLONY_ON = [Phase.COLONY, Phase.COMBAT, Phase.EXPANSION, Phase.SPACE] as const;

export const DECISIONS: readonly DecisionDef[] = [
  {
    id: 'beetle_sighting',
    phases: COLONY_ON,
    ignorePolicy: 'free',
    timerMs: 30_000,
    title: 'BEETLE SIGHTING',
    situation: 'A WORKER FOUND A DEAD BEETLE NEAR THE NEST. ITS SHELL HOLDS A LOT OF FOOD, BUT SOMETHING ELSE IS FEEDING ON IT.',
    ignoreLine: 'THE BEETLE IS LEFT TO OTHERS',
    choices: [
      {
        id: 'collect',
        label: 'COLLECT',
        costLine: '+15 FOOD · 1 IN 2: −1 WORKER',
        effects: [{ kind: 'add', resource: 'food', amount: 15 }],
        risk: { chance: 0.5, effects: [{ kind: 'add', resource: 'workers', amount: -1 }] },
      },
      {
        id: 'scavenge',
        label: 'SCAVENGE THE EDGE',
        costLine: '+5 FOOD · NO RISK',
        effects: [{ kind: 'add', resource: 'food', amount: 5 }],
      },
    ],
  },
  {
    id: 'overcrowding',
    phases: COLONY_ON,
    ignorePolicy: 'costly',
    timerMs: 45_000,
    title: 'OVERCROWDING',
    situation: 'THE NEST IS CRAMPED. WORKERS CLIMB OVER EACH OTHER AND THE STORES ARE TRAMPLED.',
    ignoreLine: 'THE CRUSH SPOILS 10% OF THE FOOD',
    choices: [
      {
        id: 'expand',
        label: 'EXPAND',
        costLine: '−25 FOOD · +10 CAPACITY',
        requires: { resource: 'food', amount: 25 },
        effects: [
          { kind: 'add', resource: 'food', amount: -25 },
          { kind: 'add', resource: 'nestCapacity', amount: 10 },
        ],
      },
      {
        id: 'cull',
        label: 'CULL',
        costLine: '−10% WORKERS',
        effects: [{ kind: 'lose_percent', resource: 'workers', percent: 10 }],
      },
    ],
    ignore: [{ kind: 'lose_percent', resource: 'food', percent: 10 }],
  },
  {
    id: 'scout_report',
    phases: [Phase.EXPANSION, Phase.SPACE],
    ignorePolicy: 'unavoidable',
    title: 'SCOUT REPORT',
    situation: 'SCOUTS SAW MOVEMENT BEYOND THE MAPPED GROUND. SOMETHING IS OUT THERE, AND IT HAS SEEN THEM TOO.',
    ignoreLine: 'NOT POSSIBLE. THE SCOUTS WAIT FOR AN ORDER',
    choices: [
      {
        id: 'investigate',
        label: 'INVESTIGATE',
        costLine: 'UP TO 3 TILES · 1 IN 2: −1 SCOUT',
        effects: [{ kind: 'reveal_tiles', count: 3 }],
        risk: { chance: 0.5, effects: [{ kind: 'lose_scouts', count: 1 }] },
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
  return `${def.title} IGNORED: ${def.ignoreLine}`;
}
