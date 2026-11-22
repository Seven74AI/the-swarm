import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { rolesForPhase } from '../../../../src/data/content/roles';
import { WorkersPrimary, WorkersTab, foodLineDecimals } from '../../../../src/ui/wrkr/WorkersTab';
import {
  assignedTotal,
  freeWorkers,
  getReallocation,
  roleCount,
  workforceTotal,
} from '../../../../src/systems/Workforce';
import { computeResourceRates } from '../../../../src/systems/ResourceSystem';
import { TerritorySystem } from '../../../../src/systems/TerritorySystem';

import { roleBalance } from '../../../../src/data/balance/roles';
import { BAR_CELLS } from '../../../../src/ui/wrkr/roleBar';
import { testActions } from '../../helpers/actions';
import { makeState, type StateOverrides } from '../../helpers/makeState';

/**
 * Story 1.23 (UX-DR15): WRKR. One row per role in the role data (name, text
 * bar, count, stepper) under one ×1 ×10 ×MAX row; the upkeep readout updates
 * with every assignment; the primary action is the most useful reallocation.
 */

const tap = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
};
const row = (c: ParentNode, role: string) => c.querySelector<HTMLElement>(`[data-role="${role}"]`)!;
const plus = (c: ParentNode, role: string) => row(c, role).querySelector<HTMLElement>('[data-step="add"]')!;
const minus = (c: ParentNode, role: string) => row(c, role).querySelector<HTMLElement>('[data-step="remove"]')!;
const count = (c: ParentNode, role: string) => Number(row(c, role).querySelector('.role-count')!.textContent);
const rates = () => computeResourceRates(gameState.value, new TerritorySystem().getBonuses(gameState.value));

function seed(over: StateOverrides = {}): void {
  gameState.value = makeState({ phase: Phase.COLONY, resources: { workers: 12, food: 500, nestCapacity: 1000 }, ...over });
}

function mount() {
  const actions = testActions();
  return render(
    <>
      <WorkersTab actions={actions} />
      <div data-primary="">
        <WorkersPrimary actions={actions} />
      </div>
    </>,
  ).container;
}

describe('WRKR tab (Story 1.23)', () => {
  beforeEach(() => seed());
  afterEach(() => cleanup());

  it('shows one row per role of the phase, each with name, aria-hidden bar, count and stepper', () => {
    const c = mount();
    const roles = rolesForPhase(Phase.COLONY);
    expect(c.querySelectorAll('[data-role]')).toHaveLength(roles.length);
    for (const r of roles) {
      const el = row(c, r.id);
      expect(el.textContent).toContain(r.label);
      const bar = el.querySelector('[data-role-bar]')!;
      expect(bar.getAttribute('aria-hidden')).toBe('true');
      expect(bar.textContent!.length).toBeLessThanOrEqual(BAR_CELLS);
      expect(count(c, r.id)).toBe(roleCount(gameState.value, r.id));
      expect(el.querySelector('[data-step="add"]')).not.toBeNull();
      expect(el.querySelector('[data-step="remove"]')).not.toBeNull();
    }
    expect(c.querySelector('[data-role="research"]')).toBeNull();
  });

  it('puts the one multiplier row above the role rows', () => {
    const c = mount();
    const rows = c.querySelectorAll('.stepper__multipliers');
    expect(rows).toHaveLength(1);
    const first = c.querySelector('[data-role]')!;
    expect(rows[0].compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds the Research row once research opens', () => {
    seed({ phase: Phase.SPACE });
    const c = mount();
    expect(row(c, 'research')).not.toBeNull();
  });

  it('fills the bar with the role’s workers', async () => {
    seed({ resources: { workers: 10 }, workersAssigned: { gather: 4 } });
    const c = mount();
    expect(row(c, 'gather').querySelector('[data-role-bar] [data-filled]')!.textContent).toBe('█'.repeat(4));
  });

  it('applies a step at once and updates count, bar and upkeep readout in the same render', async () => {
    const c = mount();
    const before = c.querySelector('[data-production-value]')!.textContent;
    await act(() => tap(plus(c, 'gather')));
    expect(count(c, 'gather')).toBe(1);
    expect(gameState.value.workersAssigned.gather).toBe(1);
    const dec = foodLineDecimals(rates().foodProducedPerSec, rates().foodConsumedPerSec);
    expect(Number(c.querySelector('[data-production-value]')!.textContent!.replace(/\s/g, ''))).toBeCloseTo(rates().foodProducedPerSec, dec - 1);
    expect(c.querySelector('[data-production-value]')!.textContent).not.toBe(before);
    expect(Number(c.querySelector('[data-upkeep-value]')!.textContent!.replace(/\s/g, ''))).toBeCloseTo(rates().foodConsumedPerSec, dec - 1);
    expect(c.querySelector('[data-upkeep]')!.textContent).toMatch(/FOOD IN \+\S+\/S ·,? EATEN −\S+\/S ·,? NET/);
  });

  it('disables [+] with "no free workers" when none are free, while reassigning still works', async () => {
    seed({ resources: { workers: 4 }, workersAssigned: { gather: 2, tend: 2 } });
    const c = mount();
    for (const r of rolesForPhase(Phase.COLONY)) {
      expect(plus(c, r.id).getAttribute('aria-disabled')).toBe('true');
      expect(row(c, r.id).textContent).toContain('no free workers');
    }
    await act(() => tap(minus(c, 'tend')));
    expect(count(c, 'tend')).toBe(1);
    expect(plus(c, 'dig').getAttribute('aria-disabled')).toBeNull();
    await act(() => tap(plus(c, 'dig')));
    expect(count(c, 'dig')).toBe(1);
    expect(freeWorkers(gameState.value)).toBe(0);
  });

  it('×MAX assigns every free worker and no more', async () => {
    seed({ resources: { workers: 30 }, workersAssigned: { tend: 3 } });
    const c = mount();
    const free = freeWorkers(gameState.value);
    await act(() => {
      fireEvent.click(c.querySelector('[data-multiplier="max"]')!);
    });
    await act(() => tap(plus(c, 'gather')));
    expect(count(c, 'gather')).toBe(free);
    expect(freeWorkers(gameState.value)).toBe(0);
    await act(() => tap(plus(c, 'dig')));
    expect(count(c, 'dig')).toBe(0);
  });

  it('counts Research toward the assigned total', async () => {
    seed({ phase: Phase.SPACE, resources: { workers: 10 } });
    const c = mount();
    await act(() => tap(plus(c, 'research')));
    await act(() => tap(plus(c, 'research')));
    expect(count(c, 'research')).toBe(2);
    const line = c.querySelector('[data-assigned]')!.textContent!;
    expect(line).toContain(`${assignedTotal(gameState.value)} / ${workforceTotal(gameState.value)}`);
    expect(c.querySelector('[data-free]')!.textContent).toContain(String(freeWorkers(gameState.value)));
  });

  it('the net is exactly the food in minus the food eaten, as shown', () => {
    // Rates whose rounded parts once disagreed with the unrounded net (10 − 7 shown as +2).
    for (const assigned of [{ gather: 3, tend: 4 }, { gather: 5, dig: 2 }, { tend: 6 }, { gather: 1 }]) {
      cleanup();
      seed({ resources: { workers: 9 }, workersAssigned: assigned });
      const c = mount();
      const num = (sel: string) => Number(c.querySelector(sel)!.textContent!.replace(/[^\d.]/g, ''));
      const net = c.querySelector('[data-net]')!.textContent!;
      const sign = net.includes('−') || net.includes('-') ? -1 : 1;
      const netValue = sign * Number(net.replace(/[^\d.]/g, ''));
      expect(netValue).toBeCloseTo(num('[data-production-value]') - num('[data-upkeep-value]'), 5);
    }
  });

  it('every number in the food readout is a rate per second', () => {
    seed({ resources: { workers: 9 }, workersAssigned: { gather: 3 } });
    const c = mount();
    const text = c.querySelector('[data-upkeep]')!.textContent!;
    const numbers = text.match(/\d+(\.\d+)?/g)!;
    const rates = text.match(/\d+(\.\d+)?\/S/g)!;
    expect(rates.length).toBe(numbers.length);
  });

  it('the DIG row never promises more digging than the balance gives', () => {
    seed({ resources: { workers: 9 } });
    const c = mount();
    const tip = row(c, 'dig').getAttribute('data-tooltip') ?? '';
    expect(tip).not.toMatch(/per second/i);
    // The tooltip names the real time one digger takes per room.
    const hours = Math.round(roleBalance.digMsPerRoom / 3_600_000);
    expect(tip).toContain(String(hours));
  });

  it('shows a negative net in warn with ▼', () => {
    seed({ resources: { workers: 20, food: 0 }, workersAssigned: { tend: 20 } });
    const c = mount();
    const net = c.querySelector('[data-net]')!;
    expect(net.getAttribute('data-trend')).toBe('down');
    expect(net.textContent).toContain('▼');
  });

  it('shows no ▼ when production covers upkeep', () => {
    seed({ resources: { workers: 10 }, workersAssigned: { gather: 10 } });
    const c = mount();
    expect(c.querySelector('[data-net]')!.textContent).not.toContain('▼');
  });
});

describe('WRKR primary action (Story 1.23)', () => {
  afterEach(() => cleanup());

  it('offers the most useful reallocation and performs it in one press', async () => {
    seed({ resources: { workers: 40, food: 0 }, workersAssigned: { tend: 30 } });
    const suggestion = getReallocation(gameState.value)!;
    expect(suggestion).not.toBeNull();
    const c = mount();
    const btn = c.querySelector<HTMLElement>('[data-action="reallocate"]')!;
    expect(btn.querySelector('[data-verb]')!.textContent).toBe('MOVE');
    expect(btn.querySelector('[data-target]')!.textContent).toBe(`${suggestion.count} TO GATHER`);
    const gather = gameState.value.workersAssigned.gather;
    await act(() => tap(btn));
    expect(gameState.value.workersAssigned.gather).toBe(gather + suggestion.count);
  });

  it('shows nothing when no reallocation helps', () => {
    seed({ resources: { workers: 10 }, workersAssigned: { gather: 10 } });
    const c = mount();
    expect(c.querySelector('[data-action="reallocate"]')).toBeNull();
  });
});
