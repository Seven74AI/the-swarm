import { useLayoutEffect } from 'preact/hooks';
import { Phase } from '../../phases/phases';
import {
  selectConditionCurrent,
  selectConditionMet,
  selectConditionTarget,
  selectGoal,
  selectGoalPercent,
  selectPhase,
  type GoalCondition,
} from '../../state/selectors';
import { formatFull } from '../../utils/format';
import { Meter } from '../primitives/Meter';
import './GoalMeter.css';

/**
 * The phase line and goal meter (Story 1.18; UX-DR13, DESIGN.md → Layout
 * skeleton and Condensed goal meter). They replace the legacy PhaseIndicator.
 *
 * Every number comes from the goal's conditions in `phases/transitions.ts`,
 * read through `state/selectors.ts`: nothing here knows a threshold, and
 * nothing names the next phase (only the current one, on the phase line).
 *
 * Hooks: `[data-goal-meter=full|condensed]`, `[data-goal-next]`,
 * `ul[data-goal-conditions] > li[data-condition=<id>][data-met]` with
 * `[data-condition-value]`, `[data-condition-state]` (met/need) and
 * `[data-condition-mark]` (✓/✗); `[data-phase-name]`.
 */

/** The current phase's name on the phase line (kept from PhaseIndicator; E2E specs read it). */
export const PHASE_TITLES: Readonly<Record<Phase, string>> = {
  [Phase.EGG_LAYING]: 'The Lonely Queen',
  [Phase.COLONY]: 'The Colony',
  [Phase.COMBAT]: 'The War',
  [Phase.EXPANSION]: 'The Expansion',
  [Phase.SPACE]: 'The Space Age',
  [Phase.TRANSCENDENCE]: 'Transcendence',
};

/** `50 WORKERS`, or the singular when the target is 1 (`1 GUARD`). */
function goalPart(c: GoalCondition): string {
  const target = selectConditionTarget(c).value;
  const noun = target === 1 && c.one ? c.one : c.label;
  return `${formatFull(target)} ${noun.toUpperCase()}`;
}

function valueText(pct: number): string {
  return `Next goal ${pct} percent`;
}

function ConditionRow({ c }: { c: GoalCondition }) {
  const met = selectConditionMet(c).value;
  const now = selectConditionCurrent(c).value;
  const target = selectConditionTarget(c).value;
  return (
    <li class="goal-meter__row" data-condition={c.id} data-met={met ? 'true' : 'false'}>
      <span class="goal-meter__label">{c.label}</span>{' '}
      <span class="goal-meter__value" data-condition-value="">
        {formatFull(now)}/{formatFull(target)}
      </span>{' '}
      <span class="goal-meter__state" data-condition-state="" aria-hidden="true">
        {met ? 'met' : 'need'}
      </span>
      <span class="visually-hidden">{met ? 'met' : 'not met'}</span>{' '}
      <span class="goal-meter__mark" data-condition-mark="" aria-hidden="true">
        {met ? '✓' : '✗'}
      </span>
    </li>
  );
}

/** NEST: `NEXT: <conditions>`, the meter, and one row per condition. */
export function GoalMeter() {
  const goal = selectGoal.value;
  const pct = selectGoalPercent.value;
  if (!goal) return null;
  return (
    <div class="goal-meter" data-goal-meter="full">
      <p class="goal-meter__next" data-goal-next="">
        NEXT: {goal.conditions.map(goalPart).join(' + ')}
      </p>
      <Meter value={pct} max={100} valueText={valueText(pct)} />
      <ul class="goal-meter__conditions" data-goal-conditions="">
        {goal.conditions.map((c) => (
          <ConditionRow key={c.id} c={c} />
        ))}
      </ul>
    </div>
  );
}

/** Every tab but NEST: one line, `NEXT ████······ 74%`. */
export function CondensedGoalMeter() {
  const goal = selectGoal.value;
  const pct = selectGoalPercent.value;
  if (!goal) return null;
  return (
    <div class="goal-line" data-goal-meter="condensed">
      <span class="goal-line__next" aria-hidden="true">
        NEXT
      </span>{' '}
      <Meter value={pct} max={100} valueText={valueText(pct)} brackets={false} />
    </div>
  );
}

/** PhaseIndicator's per-phase class on the host (`phase-colony` …; none in Phase 1); main.css styles it. */
export function phaseClass(phase: Phase): string {
  return phase === Phase.EGG_LAYING ? '' : `phase-${phase}`;
}

/**
 * NEST's phase line: the current phase's name, then the full goal meter.
 * `host` (the `#phase-indicator` element it renders into) keeps the legacy
 * `phase-<name>` class; other classes on it (`transitioning`) are left alone.
 */
export function PhaseLine({ host }: { host?: HTMLElement } = {}) {
  const phase = selectPhase.value as Phase;
  useLayoutEffect(() => {
    if (!host) return;
    for (const p of Object.values(Phase)) {
      const cls = phaseClass(p);
      if (cls) host.classList.toggle(cls, p === phase);
    }
  }, [host, phase]);
  return (
    <>
      <span class="phase-text" data-phase-name="">
        {PHASE_TITLES[phase] ?? PHASE_TITLES[Phase.EGG_LAYING]}
      </span>
      <GoalMeter />
    </>
  );
}
