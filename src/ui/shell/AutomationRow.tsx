import type { ActionResult } from '../../actions';
import {
  selectAutomationBlock,
  selectAutomationCount,
  selectAutomationOn,
  selectAutomationShown,
  selectAutomationState,
  selectAutomationTarget,
} from '../../state/selectors';
import { AUTOMATION_BLOCK_TEXT, automationVerb, type AutomationVerb } from '../../data/content/automation';
import { automationBalance } from '../../data/balance/automation';
import { formatFull } from '../../utils/format';
import { Stepper } from '../primitives/Stepper';
import { Sep } from '../primitives/Deco';
import './AutomationRow.css';

/** The actions the row calls (a subset of `Actions`). */
export interface AutomationRowActions {
  setAutomationTarget(verb: AutomationVerb, target: number): ActionResult;
  setAutomation(verb: AutomationVerb, on: boolean): ActionResult;
}

/** `holding at 14`, `14 of 20`, or `holding at 14 · food short` (warn). */
function Status({ verb }: { verb: AutomationVerb }) {
  const kind = selectAutomationState(verb).value;
  if (kind === 'off') return null;
  const count = formatFull(selectAutomationCount(verb).value);
  const block = selectAutomationBlock(verb).value;
  return (
    <p
      class="automation-row__status"
      data-automation-status={kind}
      data-warn={kind === 'blocked' ? '' : undefined}
    >
      {kind === 'working' ? (
        <>
          {count} of {formatFull(selectAutomationTarget(verb).value)}
        </>
      ) : (
        <>holding at {count}</>
      )}
      {block && (
        <>
          <Sep />
          {AUTOMATION_BLOCK_TEXT[block]}
        </>
      )}
    </p>
  );
}

/**
 * The automation target row (Story 4.10, UX-DR16; DESIGN.md "Automation
 * target row"): `KEEP [−] N [+] IN TRAINING` and an `[AUTO]` toggle, inverse
 * when on, 44 px tall. It renders nothing until the verb can be automated
 * (`selectAutomationShown`), and goes under the verb it automates. With AUTO
 * on, the line under it says how the colony is doing.
 *
 * Hooks: `[data-automation=<verb>][data-auto=on|off]`, the stepper's
 * `[data-step]`, `button[data-action="toggle-automation"][aria-pressed]`,
 * `[data-automation-status=holding|working|blocked][data-warn]`.
 *
 * `compact` (NEST's brood line, Story 9.7): `KEEP [−] N [+] [AUTO]` on one
 * line, steps of one (no ×1/×10/×MAX row) and no "what" word (the brood
 * line beside it names the brood). The status line stays, while AUTO is on.
 */
export function AutomationRow({ verb, actions, compact = false }: { verb: AutomationVerb; actions: AutomationRowActions; compact?: boolean }) {
  if (!selectAutomationShown(verb).value) return null;
  const def = automationVerb(verb);
  const target = selectAutomationTarget(verb).value;
  const on = selectAutomationOn(verb).value;
  const things = (n: number) => `${n === 1 ? 'one' : n} ${n === 1 ? def.one : def.many}`;
  return (
    <div class={compact ? 'automation-row automation-row--compact' : 'automation-row'} data-automation={verb} data-auto={on ? 'on' : 'off'}>
      <div class="automation-row__line" role="group" aria-label={`Automation target: keep ${target} ${def.keep.toLowerCase()}`}>
        <span class="automation-row__keep">KEEP</span>
        <Stepper
          value={target}
          available={automationBalance.targets.maxTarget}
          onStep={(delta) => actions.setAutomationTarget(verb, selectAutomationTarget(verb).peek() + delta)}
          addLabel={(n) => `Keep ${things(n)} more`}
          removeLabel={(n) => `Keep ${things(n)} fewer`}
          addDisabled="at the most"
          removeDisabled="at none"
          multiplier={compact ? 1 : undefined}
          data-automation-target=""
        />
        {!compact && <span class="automation-row__what">{def.keep}</span>}
        <button
          type="button"
          class="automation-row__auto"
          aria-pressed={on ? 'true' : 'false'}
          data-action="toggle-automation"
          onClick={() => actions.setAutomation(verb, !on)}
        >
          <span aria-hidden="true">[</span>AUTO<span aria-hidden="true">]</span>
        </button>
      </div>
      <Status verb={verb} />
    </div>
  );
}
