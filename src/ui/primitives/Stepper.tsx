/**
 * Stepper primitive (Story 1.12; FR45, UX-DR15).
 *
 * `[−] value [+]`, each bracket a 44 px `Button`, with a `×1 ×10 ×MAX`
 * multiplier row above it (the active one in inverse video). Every step
 * applies at once through `onStep(delta)` (an action); there is no staging or
 * APPLY. The delta always keeps the value within 0 and `available`
 * (`stepAmount`): the caller decides what "available" means (free workers
 * plus those already assigned, capacity for ×MAX). Holding a bracket repeats
 * through Button's hold-repeat (Story 1.11) and stops at the first refusal,
 * which is also what the stepper returns once the limit is reached.
 *
 * Brackets are typed decoration: their accessible names come from the caller
 * ("Add one gatherer"), given the size of the step about to be taken.
 */
import { useRef, useState } from 'preact/hooks';
import { Button } from './Button';
import { OK, refuse } from '../../actions/result';
import './Stepper.css';

export const MULTIPLIERS = [1, 10, 'max'] as const;
export type Multiplier = (typeof MULTIPLIERS)[number];
export type StepDirection = 'add' | 'remove';

/** The signed whole step that keeps `value` within 0..`available`. */
export function stepAmount(direction: StepDirection, value: number, available: number, multiplier: Multiplier): number {
  const top = Math.max(0, Math.floor(available));
  const now = Math.min(top, Math.max(0, Math.floor(value)));
  const room = direction === 'add' ? top - now : now;
  const size = multiplier === 'max' ? room : Math.min(multiplier, room);
  return direction === 'add' ? size : -size;
}

type Name = string | ((amount: number) => string);
const nameOf = (name: Name, amount: number) => (typeof name === 'string' ? name : name(amount));
const multiplierLabel = (m: Multiplier) => (m === 'max' ? '×MAX' : `×${m}`);

export interface MultiplierRowProps {
  readonly value: Multiplier;
  readonly onChange: (m: Multiplier) => void;
}

/** `×1  ×10  ×MAX`; one stepper's own, or shared by several rows. */
export function MultiplierRow({ value, onChange }: MultiplierRowProps) {
  return (
    <div class="stepper__multipliers" role="group" aria-label="Step size">
      {MULTIPLIERS.map((m) => (
        <button
          type="button"
          key={String(m)}
          class="stepper__multiplier"
          data-multiplier={String(m)}
          aria-pressed={m === value ? 'true' : 'false'}
          onClick={() => onChange(m)}
        >
          {multiplierLabel(m)}
        </button>
      ))}
    </div>
  );
}

export interface StepperProps {
  readonly value: number;
  /** The highest value a step may reach. */
  readonly available: number;
  /** Apply a signed step (an action). A refusal stops a hold. */
  readonly onStep: (delta: number) => { readonly ok: boolean } | void;
  /** Accessible name of `[+]`, given the size of the next step. */
  readonly addLabel: Name;
  /** Accessible name of `[−]`, given the size of the next step. */
  readonly removeLabel: Name;
  /** Why `[+]` can't be used at the limit (e.g. `no free workers`). */
  readonly addDisabled?: string;
  /** Why `[−]` can't be used at zero. */
  readonly removeDisabled?: string;
  /** A multiplier owned by the caller (a shared row). Without it the stepper shows its own row. */
  readonly multiplier?: Multiplier;
  /** Starting multiplier of the stepper's own row. Default ×1. */
  readonly initialMultiplier?: Multiplier;
  /** Extra class on the value (a caller's legacy hook, e.g. WRKR's `.role-count`). */
  readonly valueClass?: string;
  [hook: `data-${string}`]: string | undefined;
}

export function Stepper(props: StepperProps) {
  const {
    value,
    available,
    onStep,
    addLabel,
    removeLabel,
    addDisabled = 'none available',
    removeDisabled = 'none to remove',
    multiplier,
    initialMultiplier = 1,
    valueClass,
    ...hooks
  } = props;
  const [own, setOwn] = useState<Multiplier>(initialMultiplier);
  const active = multiplier ?? own;
  const add = stepAmount('add', value, available, active);
  const remove = stepAmount('remove', value, available, active);
  // Repeats of a hold can outrun re-renders (Preact batches them), so the value
  // already stepped to since the last render is kept here; a new `value` resets it.
  const live = useRef({ prop: value, now: value });
  if (live.current.prop !== value) live.current = { prop: value, now: value };
  const step = (dir: StepDirection) => () => {
    const delta = stepAmount(dir, live.current.now, available, active);
    if (delta === 0) return refuse('unavailable');
    const result = onStep(delta) ?? OK;
    if (result.ok) live.current.now += delta;
    return result;
  };

  return (
    <div class="stepper" {...hooks}>
      {multiplier === undefined && <MultiplierRow value={own} onChange={setOwn} />}
      <div class="stepper__row">
        <Button
          verb="[−]"
          label={nameOf(removeLabel, Math.max(1, -remove))}
          repeat
          disabled={remove === 0 ? removeDisabled : false}
          onPress={step('remove')}
          data-step="remove"
        />
        <span class={valueClass ? `stepper__value ${valueClass}` : 'stepper__value'} data-stepper-value="">
          {Math.max(0, Math.floor(value))}
        </span>
        <Button
          verb="[+]"
          label={nameOf(addLabel, Math.max(1, add))}
          repeat
          disabled={add === 0 ? addDisabled : false}
          onPress={step('add')}
          data-step="add"
        />
      </div>
    </div>
  );
}
