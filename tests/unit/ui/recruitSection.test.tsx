import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { gameState } from '../../../src/state/gameSignal';
import { Phase } from '../../../src/phases/phases';
import { RecruitSection } from '../../../src/ui/front/RecruitSection';
import { testActions } from '../helpers/actions';
import { makeState, type StateOverrides } from '../helpers/makeState';
import { visibleText } from '../helpers/a11y';
import { recruitmentBalance } from '../../../src/data/balance/recruitment';

/**
 * Story 4.10: recruitment is a verb the player does by hand (FRONT → MAP),
 * so its automation rows have a verb to sit under: RECRUIT SCOUT and
 * RECRUIT WARRIOR, each with its target row once learned.
 */

const tap = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
};

function seed(over: StateOverrides = {}): void {
  gameState.value = makeState({
    phase: Phase.EXPANSION,
    resources: { workers: 30, food: 10_000, nestCapacity: 100 },
    workersAssigned: { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
    buildings: { barracks: { level: recruitmentBalance.warriorBarracksLevel, count: 0 } },
    ...over,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  seed();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RECRUIT on MAP', () => {
  it('recruits a scout and a warrior by hand, each counted', () => {
    const c = render(<RecruitSection actions={testActions()} />).container;
    tap(c.querySelector('[data-action="recruit-scout"]')!);
    tap(c.querySelector('[data-action="recruit-warrior"]')!);
    expect(gameState.value.soldiers.scouts).toBe(1);
    expect(gameState.value.soldiers.warriors).toBe(1);
    expect(gameState.value.automation.performed.scout).toBe(1);
    expect(gameState.value.automation.performed.warrior).toBe(1);
  });

  it('a closed barracks says what it needs', () => {
    seed({ buildings: { barracks: { level: 0, count: 0 } } });
    const c = render(<RecruitSection actions={testActions()} />).container;
    expect(c.querySelector('[data-action="recruit-scout"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(visibleText(c)).toContain('needs Barracks');
  });

  it('shows no target rows in Expansion until learned', () => {
    const c = render(<RecruitSection actions={testActions()} />).container;
    expect(c.querySelector('[data-automation="scout"]')).toBeNull();
    expect(c.querySelector('[data-automation="warrior"]')).toBeNull();
  });

  it('from the phase after, a target row sits under each verb', () => {
    seed({ phase: Phase.SPACE });
    const c = render(<RecruitSection actions={testActions()} />).container;
    expect(visibleText(c.querySelector('[data-automation="scout"]')!)).toContain('SCOUTS');
    expect(visibleText(c.querySelector('[data-automation="warrior"]')!)).toContain('WARRIORS');
  });
});
