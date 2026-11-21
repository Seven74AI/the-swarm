import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { gameState } from '../../../src/state/gameSignal';
import { Phase } from '../../../src/phases/phases';
import { AutomationRow } from '../../../src/ui/shell/AutomationRow';
import { automationBalance } from '../../../src/data/balance/automation';
import { soldierBalance } from '../../../src/data/balance/soldiers';
import { testActions } from '../helpers/actions';
import { makeState, type StateOverrides } from '../helpers/makeState';
import { visibleText } from '../helpers/a11y';

/**
 * Story 4.10 (UX-DR16): the automation target row, `KEEP [−] N [+] IN
 * TRAINING` with `[AUTO]` (inverse when on), under the verb once it can be
 * automated, with `holding at N` or a warn reason under it.
 */

const N = automationBalance.targets.unlockAfterManual;
const tap = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
};

function seed(over: StateOverrides = {}): void {
  gameState.value = makeState({
    phase: Phase.COMBAT,
    resources: { workers: 30, food: 100_000, nestCapacity: 100 },
    workersAssigned: { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
    ...over,
  });
}

const mount = () => render(<AutomationRow verb="train" actions={testActions()} />).container;

beforeEach(() => {
  vi.useFakeTimers();
  seed();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the automation target row', () => {
  it('is absent until the verb is learned', () => {
    const c = mount();
    expect(c.querySelector('[data-automation="train"]')).toBeNull();
  });

  it('appears after N manual performances, reading KEEP [−] N [+] IN TRAINING [AUTO]', () => {
    seed({ automation: { performed: { train: N } } });
    const c = mount();
    const row = c.querySelector('[data-automation="train"]')!;
    expect(row).not.toBeNull();
    const text = visibleText(row).replace(/\s+/g, ' ');
    expect(text).toContain('KEEP');
    expect(text).toContain('[−]');
    expect(text).toContain('[+]');
    expect(text).toContain('IN TRAINING');
    expect(text).toContain(String(automationBalance.targets.defaultTarget));
    const toggle = row.querySelector('[data-action="toggle-automation"]')!;
    expect(visibleText(toggle)).toContain('AUTO');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('appears from the phase after its own without any manual performance', () => {
    seed({ phase: Phase.EXPANSION });
    expect(mount().querySelector('[data-automation="train"]')).not.toBeNull();
  });

  it('[+] raises the target and [AUTO] turns it on (inverse when on)', () => {
    seed({ automation: { performed: { train: N } } });
    const c = mount();
    const before = gameState.value.automation.targets.train.target;
    tap(c.querySelector('[data-automation="train"] [data-step="add"]')!);
    expect(gameState.value.automation.targets.train.target).toBeGreaterThan(before);
    act(() => {
      (c.querySelector('[data-action="toggle-automation"]') as HTMLButtonElement).click();
    });
    expect(gameState.value.automation.targets.train.on).toBe(true);
    expect(c.querySelector('[data-action="toggle-automation"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(c.querySelector('[data-automation="train"]')!.getAttribute('data-auto')).toBe('on');
  });

  it('shows holding at N once the target is met', () => {
    seed({ combatSoldiers: 10, automation: { performed: { train: N }, targets: { train: { target: 10, on: true } } } });
    const status = mount().querySelector('[data-automation-status]')!;
    expect(status.getAttribute('data-automation-status')).toBe('holding');
    expect(visibleText(status)).toContain('holding at 10');
  });

  it('shows the warn reason when the colony cannot reach the target', () => {
    seed({
      combatSoldiers: 4,
      resources: { workers: 30, food: soldierBalance.costFood - 1, nestCapacity: 100 },
      automation: { performed: { train: N }, targets: { train: { target: 10, on: true } } },
    });
    const status = mount().querySelector('[data-automation-status]')!;
    expect(status.getAttribute('data-automation-status')).toBe('blocked');
    expect(status.hasAttribute('data-warn')).toBe(true);
    expect(visibleText(status)).toContain('holding at 4');
    expect(visibleText(status)).toContain('food short');
  });

  it('with AUTO off, no status line', () => {
    seed({ automation: { performed: { train: N } } });
    expect(mount().querySelector('[data-automation-status]')).toBeNull();
  });
});
