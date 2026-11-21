import { describe, it, expect, vi } from 'vitest';
import { createLineJump, JUMP_HIGHLIGHT_MS } from '../../../../src/ui/log/jump';
import type { SegmentId, TabId } from '../../../../src/data/content/tabs';

/** Story 1.26 (UX-DR30): tapping a line that points at something jumps to it. */
describe('createLineJump', () => {
  function setup(phase: string) {
    const calls: Array<[string, string]> = [];
    const el = document.createElement('div');
    el.scrollIntoView = vi.fn();
    const jump = createLineJump({
      phase: () => phase,
      select: (tab: TabId) => {
        calls.push(['tab', tab]);
      },
      selectSegment: (s: SegmentId) => {
        calls.push(['segment', s]);
      },
      element: () => el,
      schedule: (fn) => fn(),
    });
    return { jump, calls, el };
  }

  it('opens the tab (and FRONT segment) of the panel and scrolls it into view', () => {
    const { jump, calls, el } = setup('expansion');
    jump.jump('expedition_panel');
    expect(calls).toEqual([['tab', 'front'], ['segment', 'map']]);
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it('marks the panel for a moment, then lets go', () => {
    vi.useFakeTimers();
    try {
      const { jump, el } = setup('colony');
      jump.jump('worker_assignment');
      expect(el.hasAttribute('data-jumped')).toBe(true);
      vi.advanceTimersByTime(JUMP_HIGHLIGHT_MS);
      expect(el.hasAttribute('data-jumped')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('only jumps to panels the current phase shows', () => {
    const { jump, calls } = setup('colony');
    expect(jump.canJump('worker_assignment')).toBe(true);
    expect(jump.canJump('spaceship_panel')).toBe(false);
    expect(jump.canJump('resource_panel')).toBe(false);
    jump.jump('spaceship_panel');
    expect(calls).toEqual([]);
  });

  it('in Phase 1 there is no tab bar, so nothing jumps', () => {
    const { jump } = setup('egg_laying');
    expect(jump.canJump('event_log')).toBe(false);
  });
});
