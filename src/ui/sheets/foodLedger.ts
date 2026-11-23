import type { Actions } from '../../actions';
import type { ActionIntent } from '../../state/selectors';

/**
 * One-off food spends this session (Story 9.12, the food block's `SPENT THIS
 * HOUR`): every accepted action that lowered food, by what it bought, with
 * the wall-clock time. In memory, never saved. Actions run between ticks, so
 * a drop across one action is that action's spend.
 */
interface Spend {
  readonly label: string;
  readonly amount: number;
  readonly atMs: number;
}

let spends: Spend[] = [];

const upper = (id: string): string => id.replace(/_/g, ' ').toUpperCase();

/** What an action call bought, named for the food block. */
function labelOf(name: string, args: readonly unknown[]): string {
  switch (name) {
    case 'buyUpgrade':
    case 'buyBuilding':
      return upper(String(args[0]));
    case 'trainSoldier':
      return 'SOLDIERS';
    case 'startResearch':
      return 'RESEARCH';
    case 'researchAutomation':
    case 'buildAutomation':
      return 'AUTOMATION';
    case 'perform': {
      const intent = args[0] as ActionIntent;
      return 'id' in intent ? upper(String(intent.id)) : upper(intent.action.replace(/([A-Z])/g, '_$1'));
    }
    default:
      return upper(name.replace(/([A-Z])/g, '_$1'));
  }
}

/**
 * The actions, each call that is accepted and lowers food recorded (main wraps
 * them once). `food` reads the store; `now` the wall clock.
 */
export function withFoodLedger(actions: Actions, food: () => number, now: () => number = Date.now): Actions {
  const wrapped = { ...actions } as Record<string, unknown>;
  for (const [name, fn] of Object.entries(actions)) {
    if (typeof fn !== 'function') continue;
    wrapped[name] = (...args: unknown[]) => {
      const before = food();
      const result = (fn as (...a: unknown[]) => unknown)(...args);
      const spent = before - food();
      if (spent > 0 && (result as { ok?: boolean } | undefined)?.ok !== false) {
        spends.push({ label: labelOf(name, args), amount: Math.floor(spent), atMs: now() });
      }
      return result;
    };
  }
  return wrapped as Actions;
}

/** Food spent since `sinceMs`, by label, the biggest first. Older spends are dropped. */
export function foodSpentSince(sinceMs: number): { readonly label: string; readonly amount: number }[] {
  spends = spends.filter((s) => s.atMs >= sinceMs);
  const byLabel = new Map<string, number>();
  for (const s of spends) byLabel.set(s.label, (byLabel.get(s.label) ?? 0) + s.amount);
  return [...byLabel].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
}

/** Forget every spend (tests). */
export function resetFoodLedger(): void {
  spends = [];
}
