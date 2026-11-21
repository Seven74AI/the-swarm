import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createSheetController,
  SHEET_PRIORITIES,
  isModal,
  type SheetPriority,
  type SheetRequest,
} from '../../../../src/ui/shell/SheetController';

/**
 * Story 1.14 (AR10, UX-DR22): one signal holds the open sheet and a queue.
 * Priority: offline summary > decision event > battle summary > other modal > peek.
 * Modal sheets never stack; opening a modal closes any peek.
 */

function req(priority: SheetPriority, onClose?: () => void): SheetRequest {
  return { priority, render: () => priority, onClose };
}

const MODALS = SHEET_PRIORITIES.filter(isModal);

describe('SheetController', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('starts with nothing open and nothing queued', () => {
    const sheets = createSheetController();
    expect(sheets.state.value.open).toBeNull();
    expect(sheets.state.value.queue).toHaveLength(0);
  });

  it('lists every priority from highest to lowest, ending with peek', () => {
    expect(SHEET_PRIORITIES[0]).toBe('offline');
    expect(SHEET_PRIORITIES.indexOf('decision')).toBeLessThan(SHEET_PRIORITIES.indexOf('battle'));
    expect(SHEET_PRIORITIES.indexOf('battle')).toBeLessThan(SHEET_PRIORITIES.indexOf('modal'));
    expect(SHEET_PRIORITIES[SHEET_PRIORITIES.length - 1]).toBe('peek');
    expect(isModal('peek')).toBe(false);
    expect(MODALS.length).toBe(SHEET_PRIORITIES.length - 1);
  });

  it('opens the higher-priority sheet first when two are requested together, in either order', () => {
    for (let hi = 0; hi < SHEET_PRIORITIES.length; hi++) {
      for (let lo = hi + 1; lo < SHEET_PRIORITIES.length; lo++) {
        for (const order of [[hi, lo], [lo, hi]]) {
          const sheets = createSheetController();
          for (const i of order) sheets.open(req(SHEET_PRIORITIES[i]));
          const { open, queue } = sheets.state.value;
          expect(open?.priority, `${order.map((i) => SHEET_PRIORITIES[i])}`).toBe(SHEET_PRIORITIES[hi]);
          // The other one waits, unless it was a peek that a modal closed.
          if (SHEET_PRIORITIES[lo] !== 'peek' || order[0] === hi) {
            expect(queue.map((s) => s.priority)).toEqual([SHEET_PRIORITIES[lo]]);
          }
        }
      }
    }
  });

  it('never shows two modal sheets at once: one is open, the rest wait in priority order', () => {
    const sheets = createSheetController();
    for (const p of [...MODALS].reverse()) sheets.open(req(p));
    sheets.open(req('modal'));

    const seen: SheetPriority[] = [];
    while (sheets.state.value.open) {
      const open = sheets.state.value.open;
      seen.push(open.priority);
      sheets.close(open.id);
    }
    expect(seen).toEqual([...MODALS, 'modal']);
  });

  it('keeps first-come order among sheets of the same priority', () => {
    const sheets = createSheetController();
    const a = sheets.open(req('modal'));
    const b = sheets.open(req('modal'));
    const c = sheets.open(req('modal'));
    const order: number[] = [];
    while (sheets.state.value.open) {
      order.push(sheets.state.value.open.id);
      sheets.close(sheets.state.value.open.id);
    }
    expect(order).toEqual([a, b, c]);
  });

  it('closes an open peek when a modal opens, and does not bring it back', () => {
    const onPeekClose = vi.fn();
    const sheets = createSheetController();
    sheets.open(req('peek', onPeekClose));
    sheets.open(req('modal'));

    expect(sheets.state.value.open?.priority).toBe('modal');
    expect(onPeekClose).toHaveBeenCalledTimes(1);
    sheets.close(sheets.state.value.open!.id);
    expect(sheets.state.value.open).toBeNull();
  });

  it('replaces an open peek with a newer peek', () => {
    const first = vi.fn();
    const sheets = createSheetController();
    sheets.open(req('peek', first));
    const second = sheets.open(req('peek'));
    expect(sheets.state.value.open?.id).toBe(second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(sheets.state.value.queue).toHaveLength(0);
  });

  it('lets a peek wait behind an open modal', () => {
    const sheets = createSheetController();
    const modal = sheets.open(req('modal'));
    sheets.open(req('peek'));
    expect(sheets.state.value.open?.id).toBe(modal);
    sheets.close(modal);
    expect(sheets.state.value.open?.priority).toBe('peek');
  });

  it('sends a lower modal back to wait when a higher one arrives, and reopens it afterwards', () => {
    const sheets = createSheetController();
    const battle = sheets.open(req('battle'));
    const offline = sheets.open(req('offline'));
    expect(sheets.state.value.open?.id).toBe(offline);
    expect(sheets.state.value.queue.map((s) => s.id)).toEqual([battle]);
    sheets.close(offline);
    expect(sheets.state.value.open?.id).toBe(battle);
  });

  it('calls onClose once when a sheet closes, whether open or still waiting', () => {
    const open = vi.fn();
    const waiting = vi.fn();
    const sheets = createSheetController();
    const a = sheets.open(req('offline', open));
    const b = sheets.open(req('decision', waiting));
    sheets.close(b);
    expect(waiting).toHaveBeenCalledTimes(1);
    expect(sheets.state.value.open?.id).toBe(a);
    sheets.close(a);
    sheets.close(a);
    expect(open).toHaveBeenCalledTimes(1);
    expect(sheets.state.value.open).toBeNull();
  });

  it('ignores closing an id that is not open or waiting', () => {
    const sheets = createSheetController();
    const a = sheets.open(req('modal'));
    const before = sheets.state.value;
    sheets.close(a + 100);
    expect(sheets.state.value).toBe(before);
  });

  it('gives every request a new id', () => {
    const sheets = createSheetController();
    const ids = new Set([sheets.open(req('modal')), sheets.open(req('modal')), sheets.open(req('peek'))]);
    expect(ids.size).toBe(3);
  });

  it('never mutates a state it has published', () => {
    const sheets = createSheetController();
    sheets.open(req('battle'));
    const snapshot = sheets.state.value;
    const queue = snapshot.queue;
    sheets.open(req('offline'));
    sheets.open(req('modal'));
    expect(snapshot.open?.priority).toBe('battle');
    expect(queue).toHaveLength(0);
  });

  it('remembers the focused element as the trigger to return focus to', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const sheets = createSheetController();
    sheets.open(req('modal'));
    expect(sheets.state.value.open?.trigger).toBe(trigger);
  });

  it('passes the trigger on to a sheet requested from inside another sheet', () => {
    const trigger = document.createElement('button');
    const inside = document.createElement('button');
    const sheetEl = document.createElement('div');
    sheetEl.setAttribute('data-sheet', '');
    sheetEl.appendChild(inside);
    document.body.append(trigger, sheetEl);

    const sheets = createSheetController();
    trigger.focus();
    sheets.open(req('modal'));
    inside.focus();
    sheets.open(req('modal'));
    const [waiting] = sheets.state.value.queue;
    expect(waiting.trigger).toBe(trigger);
  });

  describe('dismiss (Story 1.30: the close shortcut)', () => {
    it('closes the open sheet and opens the next one waiting', () => {
      const sheets = createSheetController();
      const onClose = vi.fn();
      sheets.open(req('modal', onClose));
      sheets.open(req('modal'));
      expect(sheets.dismiss()).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(sheets.state.value.open).not.toBeNull();
      expect(sheets.state.value.queue).toHaveLength(0);
    });

    it('does nothing when no sheet is open', () => {
      expect(createSheetController().dismiss()).toBe(false);
    });

    it('never dismisses a decision sheet, or a sheet opened as not dismissible', () => {
      const sheets = createSheetController();
      sheets.open(req('decision'));
      expect(sheets.dismiss()).toBe(false);
      expect(sheets.state.value.open?.priority).toBe('decision');

      const other = createSheetController();
      other.open({ ...req('offline'), dismissible: false });
      expect(other.dismiss()).toBe(false);
      expect(other.state.value.open).not.toBeNull();
    });

    it('dismisses a peek', () => {
      const sheets = createSheetController();
      sheets.open(req('peek'));
      expect(sheets.dismiss()).toBe(true);
      expect(sheets.state.value.open).toBeNull();
    });
  });
});
