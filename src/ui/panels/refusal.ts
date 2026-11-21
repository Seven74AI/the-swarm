import type { ActionResult, RefusalReason } from '../../actions';

/** What the player reads when an action is refused (AR16: the UI shows the reason). */
export const REFUSAL_TEXT: Record<RefusalReason, string> = {
  cannot_afford: "CAN'T AFFORD",
  no_free_workers: 'NO FREE WORKERS',
  none_assigned: 'NONE ASSIGNED',
  at_capacity: 'AT CAPACITY',
  slots_full: 'ALL SLOTS IN USE',
  locked: 'LOCKED',
  max_level: 'MAX LEVEL',
  already_owned: 'ALREADY OWNED',
  already_running: 'ALREADY RUNNING',
  not_running: 'NOT RUNNING',
  too_few_researchers: 'TOO FEW RESEARCHERS',
  no_soldiers: 'NO SOLDIERS',
  not_ready: 'NOT READY YET',
  not_adjacent: 'NOT NEXT TO YOUR TERRITORY',
  unknown_id: 'UNKNOWN',
  unavailable: 'NOT AVAILABLE',
};

const REFUSED_CLASS = 'action-refused';
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Show an action's outcome on the control that asked for it. A refusal sets
 * `data-refusal` and the title to the reason and flashes the control; a
 * success clears them. Returns the result so calls can be chained.
 */
export function explain<R extends ActionResult>(el: HTMLElement | null | undefined, result: R): R {
  if (!el) return result;
  const pending = timers.get(el);
  if (pending) clearTimeout(pending);
  if (result.ok) {
    el.removeAttribute('data-refusal');
    el.classList.remove(REFUSED_CLASS);
    return result;
  }
  el.setAttribute('data-refusal', result.reason);
  el.setAttribute('title', REFUSAL_TEXT[result.reason]);
  el.classList.add(REFUSED_CLASS);
  timers.set(el, setTimeout(() => el.classList.remove(REFUSED_CLASS), 600));
  return result;
}
