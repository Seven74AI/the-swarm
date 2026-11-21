import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { EventBus } from '../../../../src/engine/EventBus';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { bindDecisionSheets, DECISION_AUTO_DISMISS_MS } from '../../../../src/ui/sheets/DecisionSheet';
import type { DecisionEvent } from '../../../../src/systems/DecisionSystem';

/**
 * Story 1.14: the legacy DecisionPopup renders as a decision sheet through the
 * SheetController, with its old behavior and `#decision-popup` hooks
 * (decision-popups.spec): it applies the choice through the action before
 * announcing it, auto-dismisses, and never closes by Esc or the scrim.
 */

const beetle: DecisionEvent = {
  type: 'beetle',
  title: 'Beetle Sighting',
  description: 'A large beetle was spotted.',
  choices: [
    { label: 'Collect', description: '+food, risk worker' },
    { label: 'Ignore', description: 'No change' },
  ],
};

let bus: EventBus;
let sheets: SheetController;
let choose: ReturnType<typeof vi.fn<(type: string, choice: string) => unknown>>;
let unbind: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  bus = new EventBus();
  sheets = createSheetController();
  choose = vi.fn<(type: string, choice: string) => unknown>();
  unbind = bindDecisionSheets({ bus, sheets, choose });
  render(<SheetHost sheets={sheets} />);
});
afterEach(() => {
  unbind();
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
});

const popup = () => document.getElementById('decision-popup');
const show = (e: DecisionEvent = beetle) => act(() => bus.emit('decision_event', e));

describe('decision sheet', () => {
  it('opens a decision-priority modal sheet on decision_event', () => {
    show();
    expect(sheets.state.value.open?.priority).toBe('decision');
    expect(popup()?.getAttribute('aria-modal')).toBe('true');
    expect(popup()?.querySelector('.decision-popup-title')?.textContent).toBe(beetle.title);
    expect(popup()?.querySelector('.decision-popup-desc')?.textContent).toBe(beetle.description);
  });

  it('shows one button per choice and no [ CLOSE ]', () => {
    show({
      ...beetle,
      type: 'overcrowding',
      choices: [
        { label: 'Expand', description: 'More space' },
        { label: 'Cull', description: 'Reduce pop' },
        { label: 'Wait', description: 'Hold steady' },
      ],
    });
    const buttons = popup()!.querySelectorAll('button');
    expect([...buttons].map((b) => b.dataset.choice)).toEqual(['Expand', 'Cull', 'Wait']);
    expect(popup()!.querySelector('[data-sheet-close]')).toBeNull();
  });

  it('applies the choice through the action, then announces it, then closes', () => {
    const order: string[] = [];
    choose.mockImplementation(() => order.push('action'));
    let chosen: unknown = null;
    bus.subscribe('decision_chosen', (p) => {
      order.push('event');
      chosen = p;
    });
    show();
    act(() => popup()!.querySelector<HTMLButtonElement>('[data-choice="Collect"]')!.click());
    expect(choose).toHaveBeenCalledWith('beetle', 'Collect');
    expect(order).toEqual(['action', 'event']);
    expect(chosen).toEqual({ type: 'beetle', choice: 'Collect' });
    expect(popup()).toBeNull();
    expect(sheets.state.value.open).toBeNull();
  });

  it('does not close on Esc or a scrim tap', () => {
    show();
    act(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      document.querySelector<HTMLElement>('[data-sheet-scrim]')!.click();
    });
    expect(popup()).not.toBeNull();
  });

  it('auto-dismisses after its timeout without applying a choice, and not before', () => {
    show();
    act(() => void vi.advanceTimersByTime(DECISION_AUTO_DISMISS_MS - 1));
    expect(popup()).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(popup()).toBeNull();
    expect(choose).not.toHaveBeenCalled();
  });

  it('does not run its timer while it waits behind a higher-priority sheet', () => {
    act(() => {
      sheets.open({ priority: 'offline', render: () => null });
    });
    show();
    act(() => void vi.advanceTimersByTime(DECISION_AUTO_DISMISS_MS * 2));
    expect(sheets.state.value.queue.map((s) => s.priority)).toEqual(['decision']);
    act(() => sheets.close(sheets.state.value.open!.id));
    expect(popup()).not.toBeNull();
  });

  it('replaces an open decision with a newer one instead of stacking', () => {
    show();
    show({ ...beetle, type: 'scouts', title: 'Scout Report' });
    expect(document.querySelectorAll('#decision-popup')).toHaveLength(1);
    expect(popup()!.querySelector('.decision-popup-title')?.textContent).toBe('Scout Report');
    expect(sheets.state.value.queue).toHaveLength(0);
  });

  it('renders HTML-like event text literally and still resolves the clicked choice (#189)', () => {
    const hostile: DecisionEvent = {
      type: 'beetle',
      title: '<b>x</b> "Title"',
      description: '<img src=x onerror="alert(1)"> desc',
      choices: [
        { label: 'Say "hi" <b>x</b>', description: '<i>first</i>' },
        { label: 'Plain', description: 'second' },
      ],
    };
    show(hostile);
    const el = popup()!;
    expect(el.querySelector('b, i, img')).toBeNull();
    expect(el.querySelector('.decision-popup-title')?.textContent).toBe(hostile.title);
    act(() => el.querySelectorAll('button')[0].click());
    expect(choose).toHaveBeenCalledWith('beetle', hostile.choices[0].label);
  });
});
