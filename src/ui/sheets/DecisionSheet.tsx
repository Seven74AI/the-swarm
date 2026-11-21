import { effect, untracked, type ReadonlySignal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { getDecision, type DecisionChoiceDef, type DecisionDef } from '../../data/content/decisions';
import type { OpenDecision } from '../../state/GameState';
import { displayRemainingMs, isTimed, type DecisionTimerMode } from '../../state/queries';
import { formatTime } from '../../utils/format';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';
import { Button } from '../primitives/Button';
import { Meter } from '../primitives/Meter';
import type { CoachMarkMemory } from '../primitives/CoachMark';

/**
 * The decision sheet (Story 1.28, UX-DR23, N3; Story 1.14 made it a sheet).
 *
 * It renders `state.decision.open`: it opens at `decision` priority when an
 * event is open (spawned, or loaded from the save) and closes when the event
 * leaves the state (a choice, or the countdown running out in the tick). So a
 * reload reopens it, after the offline summary, with the same time left.
 * - The situation, two choices with their visible cost or risk, a timer meter
 *   when timed, and `IGNORE: <outcome>` unless the event is unavoidable.
 * - Not dismissible: no `[ CLOSE ]`, no Esc, and its scrim lets taps through,
 *   so the colony stays playable behind it.
 * - The first timed event shows `TIMERS CAN BE SLOWED IN SETTINGS` once
 *   (remembered in settings, `coachMarksSeen`).
 * - `shown()` tells the tick whether the sheet is on screen: the countdown
 *   doesn't run while it waits behind another sheet or an overlay.
 * Hooks kept: `#decision-popup`, `.decision-popup-title`, `.decision-popup-desc`,
 * `button[data-choice]` (now the choice id). New: `[data-decision=<id>]`,
 * `[data-policy]`, `[data-decision-timer]`, `[data-ignore-line]`, `[data-timer-hint]`.
 */

export const TIMER_HINT = 'TIMERS CAN BE SLOWED IN SETTINGS';
export const TIMER_HINT_CONCEPT = 'decision-timers';

export interface DecisionSheetDeps {
  readonly sheets: SheetController;
  /** `selectOpenDecision`. */
  readonly open: ReadonlySignal<OpenDecision | null>;
  /** The overlay layer's `held`: no sheet is drawn while it is true. */
  readonly held?: ReadonlySignal<boolean>;
  /** The decision-timer setting. */
  readonly timers: ReadonlySignal<DecisionTimerMode>;
  /** `selectCanChoose`. */
  readonly canChoose: (choiceId: string) => ReadonlySignal<boolean>;
  /** `actions.chooseDecision`. */
  readonly choose: (choiceId: string) => unknown;
  /** The settings store, for the one-time timer hint. */
  readonly memory: CoachMarkMemory;
}

export interface DecisionSheets {
  /** The decision sheet is drawn now (open in the controller, no overlay up). */
  shown(): boolean;
  unbind(): void;
}

function blockedReason(c: DecisionChoiceDef): string {
  return c.requires ? `NEEDS ${c.requires.amount} ${c.requires.resource === 'nestCapacity' ? 'CAPACITY' : c.requires.resource.toUpperCase()}` : 'NOT POSSIBLE NOW';
}

function ChoiceButton({ c, deps }: { c: DecisionChoiceDef; deps: DecisionSheetDeps }) {
  const ok = deps.canChoose(c.id).value;
  return (
    <Button
      verb={c.label}
      cost={c.costLine}
      disabled={ok ? false : blockedReason(c)}
      data-choice={c.id}
      onPress={() => {
        deps.choose(c.id);
      }}
    />
  );
}

function Timer({ def, open, timers }: { def: DecisionDef; open: OpenDecision; timers: DecisionTimerMode }) {
  const left = displayRemainingMs(open, timers);
  if (left === null || def.timerMs === undefined || open.remainingMs === null) return null;
  const text = `${formatTime(left).toUpperCase()} LEFT`;
  return (
    <div class="decision-timer" data-decision-timer="">
      <Meter value={open.remainingMs} max={def.timerMs} valueText={text} />
      <span aria-hidden="true">{text}</span>
    </div>
  );
}

export function DecisionSheet({ deps }: { deps: DecisionSheetDeps }) {
  const open = deps.open.value;
  const timers = deps.timers.value;
  const def = open ? getDecision(open.id) : null;
  const timed = def !== null && isTimed(def, timers);
  // The hint shows on the first timed event, for that whole sheet.
  const [hint] = useState(() => timed && !deps.memory.settings.peek().coachMarksSeen.includes(TIMER_HINT_CONCEPT));
  useEffect(() => {
    if (!hint) return;
    const seen = deps.memory.settings.peek().coachMarksSeen;
    if (!seen.includes(TIMER_HINT_CONCEPT)) deps.memory.update({ coachMarksSeen: [...seen, TIMER_HINT_CONCEPT] });
  }, [hint, deps]);
  if (!open || !def) return null;
  return (
    <ModalSheet
      headline={def.title}
      id="decision-popup"
      headlineClass="decision-popup-title"
      dismissible={false}
      data-decision={def.id}
      data-policy={def.ignorePolicy}
      actions={[<ChoiceButton key={def.choices[0].id} c={def.choices[0]} deps={deps} />, <ChoiceButton key={def.choices[1].id} c={def.choices[1]} deps={deps} />]}
    >
      <p class="decision-popup-desc">{def.situation}</p>
      {timed && <Timer def={def} open={open} timers={timers} />}
      {def.ignorePolicy !== 'unavoidable' && <p data-ignore-line="">{`IGNORE: ${def.ignoreLine}`}</p>}
      {hint && <p data-timer-hint="">{TIMER_HINT}</p>}
    </ModalSheet>
  );
}

/** Keeps one decision sheet in step with the open event in the state. */
export function bindDecisionSheets(deps: DecisionSheetDeps): DecisionSheets {
  const { sheets } = deps;
  let current: { sheet: number; event: OpenDecision['id']; openedAt: number } | null = null;

  const closeCurrent = () => {
    if (!current) return;
    const id = current.sheet;
    current = null;
    sheets.close(id);
  };

  const stop = effect(() => {
    const open = deps.open.value;
    const key = open ? `${open.id}@${open.openedAtSessionMs}` : null;
    untracked(() => {
      if (current && (!open || `${current.event}@${current.openedAt}` !== key)) closeCurrent();
      if (!open || current) return;
      const entry = { sheet: 0, event: open.id, openedAt: open.openedAtSessionMs };
      current = entry;
      entry.sheet = sheets.open({
        priority: 'decision',
        render: () => <DecisionSheet deps={deps} />,
        onClose: () => {
          if (current === entry) current = null;
        },
      });
    });
  });

  return {
    shown: () => {
      if (!current || deps.held?.peek()) return false;
      return sheets.state.peek().open?.id === current.sheet;
    },
    unbind: () => {
      stop();
      closeCurrent();
    },
  };
}
