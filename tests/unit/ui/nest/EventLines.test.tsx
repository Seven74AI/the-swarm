import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createChronicle } from '../../../../src/state/chronicle';
import { EventLines, NEST_LINES } from '../../../../src/ui/nest/EventLines';
import type { LineJump } from '../../../../src/ui/log/jump';

/**
 * NEST's event lines (Story 1.22, UX-DR30), a Preact view of the chronicle
 * since Story 1.36: the newest `NEST_LINES`, newest first, `> ` on the newest
 * and `· ` on older ones. Hooks kept: `#activity-log`, `.log-entry`,
 * `[data-newest]`, `[data-line-prefix]`, `[data-jump]`.
 */
afterEach(() => cleanup());

const noJump: LineJump = { canJump: () => false, jump: () => {} };

function setup(jump: LineJump = noJump) {
  const chronicle = createChronicle();
  const view = render(<EventLines chronicle={chronicle} jump={jump} />);
  const lines = () => [...view.container.querySelectorAll<HTMLElement>('#activity-log .log-entry')];
  const add = (message: string, target?: 'building_panel') => act(() => chronicle.add(message, { target }));
  return { chronicle, view, lines, add };
}

describe('EventLines', () => {
  it('shows only the newest lines, newest first', () => {
    const { lines, add } = setup();
    for (let i = 1; i <= NEST_LINES + 2; i++) add(`LINE ${i}.`);
    expect(lines()).toHaveLength(NEST_LINES);
    expect(lines()[0].textContent).toContain(`LINE ${NEST_LINES + 2}.`);
    expect(lines()[1].textContent).toContain(`LINE ${NEST_LINES + 1}.`);
  });

  it('prefixes the newest line with "> " and older ones with "· "', () => {
    const { lines, add } = setup();
    add('ONE.');
    add('TWO.');
    const [newest, ...older] = lines();
    expect(newest.dataset.newest).toBe('true');
    expect(newest.querySelector('[data-line-prefix]')?.textContent).toBe('> ');
    expect(older.length).toBeGreaterThan(0);
    for (const line of older) {
      expect(line.dataset.newest).toBe('false');
      expect(line.querySelector('[data-line-prefix]')?.textContent).toBe('· ');
    }
  });

  it('draws a loaded chronicle', () => {
    const { chronicle, lines } = setup();
    act(() => chronicle.load({ entries: [{ message: 'LOADED LINE.', timestamp: 1 }], milestones: [] }));
    expect(lines()[0].textContent).toContain('LOADED LINE.');
  });

  it('a line that points somewhere jumps there when tapped', () => {
    const jumps: string[] = [];
    const { lines, add } = setup({ canJump: () => true, jump: (id) => void jumps.push(id) });
    add('THE WALLS RISE.', 'building_panel');
    const btn = lines()[0].querySelector<HTMLElement>('[data-jump]');
    expect(btn?.dataset.jump).toBe('building_panel');
    btn!.click();
    expect(jumps).toEqual(['building_panel']);
  });

  it('is a real list, and a new line leaves the others in place, so the log region reads only the new one (Story 1.32)', () => {
    const { view, add } = setup();
    add('ONE.');
    const list = view.container.querySelector('[role="log"] > ol')!;
    expect(list).not.toBeNull();
    const before = [...list.children];
    expect(before.every((li) => li.tagName === 'LI')).toBe(true);
    add('TWO.');
    const after = [...list.children];
    expect(after[0].textContent).toContain('TWO.');
    // The lines that were there are the same nodes, not redrawn copies.
    expect(after.slice(1)).toEqual(before.slice(0, after.length - 1));
  });

  it('keeps the nodes even once the chronicle is full', () => {
    const { chronicle, view, add } = setup();
    for (let i = 0; i < 120; i++) add(`LINE ${i}.`);
    const list = view.container.querySelector('[role="log"] > ol')!;
    const before = [...list.children];
    expect(chronicle.entries.value.length).toBeLessThan(121);
    add('NEWEST.');
    const after = [...list.children];
    expect(after.slice(1)).toEqual(before.slice(0, after.length - 1));
  });
});
