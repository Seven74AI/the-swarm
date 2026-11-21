import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import { signal, type Signal } from '@preact/signals';
import '@preact/signals';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { bindDecisionSheets, TIMER_HINT, TIMER_HINT_CONCEPT, type DecisionSheets } from '../../../../src/ui/sheets/DecisionSheet';
import { DECISIONS, type DecisionDef } from '../../../../src/data/content/decisions';
import type { OpenDecision } from '../../../../src/state/GameState';
import type { DecisionTimerMode } from '../../../../src/state/queries';
import { visibleText } from '../../helpers/a11y';

/**
 * Story 1.28 (UX-DR23): the decision sheet renders `state.decision.open`. It
 * shows the situation, two choices with their cost or risk, a timer meter when
 * timed and the IGNORE line; it can't be closed with Esc or the scrim; it
 * closes when the event leaves the state. Hooks kept: `#decision-popup`,
 * `.decision-popup-title`, `.decision-popup-desc`, `button[data-choice]`.
 */

const byPolicy = (p: DecisionDef['ignorePolicy']): DecisionDef => DECISIONS.find((d) => d.ignorePolicy === p)!;
const opened = (def: DecisionDef): OpenDecision => ({ id: def.id, remainingMs: def.timerMs ?? null, openedAtSessionMs: 0, roll: 0.5 });

let sheets: SheetController;
let open: Signal<OpenDecision | null>;
let timers: Signal<DecisionTimerMode>;
let held: Signal<boolean>;
let affordable: Signal<boolean>;
let seen: Signal<{ coachMarksSeen: readonly string[] }>;
let choose: ReturnType<typeof vi.fn<(choice: string) => unknown>>;
let bound: DecisionSheets;

beforeEach(() => {
  sheets = createSheetController();
  open = signal<OpenDecision | null>(null);
  timers = signal<DecisionTimerMode>('normal');
  held = signal(false);
  affordable = signal(true);
  seen = signal<{ coachMarksSeen: readonly string[] }>({ coachMarksSeen: [] });
  choose = vi.fn<(choice: string) => unknown>();
  bound = bindDecisionSheets({
    sheets,
    open,
    held,
    timers,
    canChoose: () => affordable,
    choose,
    memory: { settings: seen, update: (p) => (seen.value = { ...seen.value, ...p }) },
  });
  render(<SheetHost sheets={sheets} held={held} />);
});
afterEach(() => {
  bound.unbind();
  cleanup();
  document.body.replaceChildren();
});

const popup = () => document.getElementById('decision-popup');
const show = (def: DecisionDef) => act(() => void (open.value = opened(def)));

describe('decision sheet', () => {
  it('opens a decision-priority modal for the open event, with its situation and two choices', () => {
    const def = byPolicy('costly');
    show(def);
    expect(sheets.state.value.open?.priority).toBe('decision');
    expect(popup()?.getAttribute('aria-modal')).toBe('true');
    expect(popup()!.querySelector('.decision-popup-title')?.textContent).toBe(def.title);
    expect(popup()!.querySelector('.decision-popup-desc')?.textContent).toBe(def.situation);
    const buttons = [...popup()!.querySelectorAll<HTMLButtonElement>('button[data-choice]')];
    expect(buttons.map((b) => b.dataset.choice)).toEqual(def.choices.map((c) => c.id));
    for (const c of def.choices) expect(visibleText(popup()!)).toContain(c.costLine);
    expect(popup()!.querySelector('[data-sheet-close]')).toBeNull();
  });

  it('a timed event shows a timer meter and its IGNORE line', () => {
    const def = byPolicy('costly');
    show(def);
    expect(popup()!.querySelector('[data-decision-timer] [role="progressbar"]')).not.toBeNull();
    expect(popup()!.querySelector('[data-ignore-line]')?.textContent).toBe(`IGNORE: ${def.ignoreLine}`);
  });

  it('an unavoidable event has no timer and no IGNORE line; timers off removes the meter', () => {
    show(byPolicy('unavoidable'));
    expect(popup()!.querySelector('[data-decision-timer]')).toBeNull();
    expect(popup()!.querySelector('[data-ignore-line]')).toBeNull();
    act(() => void (open.value = null));
    act(() => void (timers.value = 'off'));
    show(byPolicy('free'));
    expect(popup()!.querySelector('[data-decision-timer]')).toBeNull();
    expect(popup()!.querySelector('[data-ignore-line]')).not.toBeNull();
  });

  it('a choice calls the action; the sheet closes when the event leaves the state, not before', () => {
    const def = byPolicy('free');
    show(def);
    act(() => popup()!.querySelector<HTMLButtonElement>(`[data-choice="${def.choices[0].id}"]`)!.click());
    expect(choose).toHaveBeenCalledWith(def.choices[0].id);
    expect(popup()).not.toBeNull();
    act(() => void (open.value = null));
    expect(popup()).toBeNull();
    expect(sheets.state.value.open).toBeNull();
  });

  it('does not close on Esc (the close shortcut) or a scrim tap', () => {
    show(byPolicy('free'));
    act(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      document.querySelector<HTMLElement>('[data-sheet-scrim]')!.click();
    });
    expect(popup()).not.toBeNull();
    // Esc reaches sheets through `SheetController.dismiss` (Story 1.30), which refuses a decision.
    act(() => void expect(sheets.dismiss()).toBe(false));
    expect(popup()).not.toBeNull();
  });

  it('a choice the colony cannot pay for is disabled with its reason', () => {
    affordable.value = false;
    show(byPolicy('costly'));
    const btn = popup()!.querySelector<HTMLButtonElement>('button[data-choice]')!;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    act(() => btn.click());
    expect(choose).not.toHaveBeenCalled();
  });

  it('is shown only when drawn: not while it waits behind a higher sheet or an overlay', () => {
    act(() => void sheets.open({ priority: 'offline', render: () => null }));
    show(byPolicy('costly'));
    expect(popup()).toBeNull();
    expect(bound.shown()).toBe(false);
    act(() => sheets.close(sheets.state.value.open!.id));
    expect(popup()).not.toBeNull();
    expect(bound.shown()).toBe(true);
    act(() => void (held.value = true));
    expect(bound.shown()).toBe(false);
  });

  it('the first timed event shows the timer hint once, ever', () => {
    show(byPolicy('costly'));
    expect(popup()!.querySelector('[data-timer-hint]')?.textContent).toBe(TIMER_HINT);
    expect(seen.value.coachMarksSeen).toContain(TIMER_HINT_CONCEPT);
    act(() => void (open.value = null));
    show(byPolicy('free'));
    expect(popup()!.querySelector('[data-timer-hint]')).toBeNull();
  });

  it('an untimed event does not use up the timer hint', () => {
    show(byPolicy('unavoidable'));
    expect(popup()!.querySelector('[data-timer-hint]')).toBeNull();
    expect(seen.value.coachMarksSeen).not.toContain(TIMER_HINT_CONCEPT);
  });

  it('a new event replaces the sheet instead of stacking', () => {
    show(byPolicy('free'));
    act(() => void (open.value = null));
    show(byPolicy('costly'));
    expect(document.querySelectorAll('#decision-popup')).toHaveLength(1);
    expect(sheets.state.value.queue).toHaveLength(0);
  });
});
