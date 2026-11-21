import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../../src/state/GameState';
import { Phase, PHASE_ORDER } from '../../../../src/phases/phases';
import { goalFor, type GoalCondition } from '../../../../src/phases/transitions';
import { formatFull } from '../../../../src/utils/format';
import { GoalMeter, CondensedGoalMeter, PhaseLine, PHASE_TITLES, phaseClass } from '../../../../src/ui/shell/GoalMeter';

/**
 * Story 1.18 (UX-DR13): NEST's goal meter reads `NEXT: <conditions>` with one
 * row per condition (met/need, ✓/✗, current/target), never naming the next
 * phase. Numbers come from the conditions in `transitions.ts`, never from here.
 */

const initial = gameState.value;

function inPhase(phase: Phase, patch: (s: GameState) => GameState = (s) => s): GameState {
  return patch({ ...createInitialState(), phase });
}

/** Puts a COLONY state with the workers condition met and the guard condition not met. */
function colonyHalfway(): { workers: GoalCondition; guard: GoalCondition } {
  const goal = goalFor(Phase.COLONY)!;
  const workers = goal.conditions.find((c) => c.id === 'workers')!;
  const guard = goal.conditions.find((c) => c.id === 'guard')!;
  gameState.value = inPhase(Phase.COLONY, (s) => ({
    ...s,
    resources: { ...s.resources, workers: workers.target(s) },
    workersAssigned: { ...s.workersAssigned, guard: 0 },
  }));
  return { workers, guard };
}

describe('GoalMeter (Story 1.18)', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });

  it('reads NEXT: followed by every condition of the goal', () => {
    colonyHalfway();
    const { container } = render(<GoalMeter />);
    const next = container.querySelector('[data-goal-next]')!;
    expect(next.textContent).toMatch(/^NEXT: /);
    for (const c of goalFor(Phase.COLONY)!.conditions) {
      expect(next.textContent).toContain(formatFull(c.target(gameState.value)));
    }
  });

  it('has one list item per condition, each with current/target and met or need', () => {
    const { workers, guard } = colonyHalfway();
    const { container } = render(<GoalMeter />);
    const list = container.querySelector('ul[data-goal-conditions]')!;
    const items = list.querySelectorAll('li[data-condition]');
    expect(items.length).toBe(goalFor(Phase.COLONY)!.conditions.length);

    const s = gameState.value;
    const w = list.querySelector<HTMLElement>('[data-condition="workers"]')!;
    expect(w.dataset.met).toBe('true');
    expect(w.textContent).toContain(`${formatFull(workers.current(s))}/${formatFull(workers.target(s))}`);
    expect(w.querySelector('[data-condition-state]')!.textContent).toBe('met');
    expect(w.querySelector('[data-condition-mark]')!.textContent).toBe('✓');

    const g = list.querySelector<HTMLElement>('[data-condition="guard"]')!;
    expect(g.dataset.met).toBe('false');
    expect(g.textContent).toContain(`${formatFull(guard.current(s))}/${formatFull(guard.target(s))}`);
    expect(g.querySelector('[data-condition-state]')!.textContent).toBe('need');
    expect(g.querySelector('[data-condition-mark]')!.textContent).toBe('✗');
  });

  it('each item reads "met" or "not met" to assistive tech; the typed marks are hidden', () => {
    colonyHalfway();
    const { container } = render(<GoalMeter />);
    const said = (li: Element) =>
      [...li.querySelectorAll('*')]
        .filter((el) => el.children.length === 0 && !el.closest('[aria-hidden="true"]'))
        .map((el) => el.textContent)
        .join(' ');
    const w = container.querySelector('[data-condition="workers"]')!;
    const g = container.querySelector('[data-condition="guard"]')!;
    expect(said(w)).toMatch(/\bmet\b/);
    expect(said(w)).not.toMatch(/not met/);
    expect(said(g)).toMatch(/not met/);
    expect(w.querySelector('[data-condition-mark]')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(g.querySelector('[data-condition-state]')!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('updates a row when its condition changes', async () => {
    const { guard } = colonyHalfway();
    const { container } = render(<GoalMeter />);
    await act(() => {
      const s = gameState.value;
      gameState.value = { ...s, workersAssigned: { ...s.workersAssigned, guard: guard.target(s) } };
    });
    expect(container.querySelector<HTMLElement>('[data-condition="guard"]')!.dataset.met).toBe('true');
    expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('100');
  });

  it('never names the next phase, in any phase', () => {
    for (const phase of PHASE_ORDER) {
      const goal = goalFor(phase);
      if (!goal) continue;
      gameState.value = inPhase(phase);
      const full = render(<GoalMeter />);
      const condensed = render(<CondensedGoalMeter />);
      for (const view of [full, condensed]) {
        const text = (view.container.textContent ?? '').toLowerCase();
        const label = [...view.container.querySelectorAll('[aria-valuetext],[aria-label]')]
          .map((el) => `${el.getAttribute('aria-valuetext') ?? ''} ${el.getAttribute('aria-label') ?? ''}`)
          .join(' ')
          .toLowerCase();
        for (const said of [text, label]) {
          expect(said).not.toContain(goal.to.toLowerCase());
          expect(said).not.toContain(goal.to.replace('_', ' ').toLowerCase());
          expect(said).not.toContain(PHASE_TITLES[goal.to].toLowerCase());
        }
      }
      cleanup();
    }
  });

  it('renders nothing after the last phase (no goal left)', () => {
    gameState.value = inPhase(Phase.TRANSCENDENCE);
    expect(render(<GoalMeter />).container.querySelector('[data-goal-meter]')).toBeNull();
    expect(render(<CondensedGoalMeter />).container.querySelector('[data-goal-meter]')).toBeNull();
  });
});

describe('CondensedGoalMeter (Story 1.18)', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });

  it('is one line: NEXT, the bare meter and its percentage, without the condition rows', () => {
    colonyHalfway();
    const { container } = render(<CondensedGoalMeter />);
    const line = container.querySelector('[data-goal-meter="condensed"]')!;
    expect(line.textContent).toMatch(/^NEXT /);
    expect(line.querySelector('[data-goal-conditions]')).toBeNull();
    const bar = line.querySelector('[role="progressbar"]')!;
    const pct = Number(bar.getAttribute('aria-valuenow'));
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
    expect(line.querySelector('[data-meter-pct]')!.textContent).toBe(`${pct}%`);
    expect(line.querySelector('.meter__bar')!.textContent).not.toContain('[');
  });
});

describe('PhaseLine (Story 1.18, replaces PhaseIndicator)', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });

  it('names the current phase above the full goal meter', async () => {
    gameState.value = inPhase(Phase.EGG_LAYING);
    const { container } = render(<PhaseLine />);
    expect(container.querySelector('[data-phase-name]')!.textContent).toBe(PHASE_TITLES[Phase.EGG_LAYING]);
    expect(container.querySelector('[data-goal-meter="full"]')).not.toBeNull();
    await act(() => {
      gameState.value = inPhase(Phase.COLONY);
    });
    expect(container.querySelector('[data-phase-name]')!.textContent).toBe(PHASE_TITLES[Phase.COLONY]);
  });

  it('has a title for every phase', () => {
    for (const phase of PHASE_ORDER) expect(PHASE_TITLES[phase].trim()).not.toBe('');
  });

  it('keeps the legacy phase-<name> class on its host, and leaves other classes alone', async () => {
    gameState.value = inPhase(Phase.EGG_LAYING);
    const host = document.createElement('div');
    host.className = 'phase-indicator transitioning';
    document.body.appendChild(host);
    render(<PhaseLine host={host} />, { container: host });
    expect([...host.classList].some((c) => c.startsWith('phase-') && c !== 'phase-indicator')).toBe(false);
    await act(() => {
      gameState.value = inPhase(Phase.COLONY);
    });
    expect(host.classList.contains(phaseClass(Phase.COLONY))).toBe(true);
    await act(() => {
      gameState.value = inPhase(Phase.COMBAT);
    });
    expect(host.classList.contains(phaseClass(Phase.COMBAT))).toBe(true);
    expect(host.classList.contains(phaseClass(Phase.COLONY))).toBe(false);
    expect(host.classList.contains('phase-indicator')).toBe(true);
    expect(host.classList.contains('transitioning')).toBe(true);
  });
});

