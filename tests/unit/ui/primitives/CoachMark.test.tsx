import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { CoachMark, type CoachMarkMemory } from '../../../../src/ui/primitives/CoachMark';

/** Story 1.12 (UX-DR29): once per concept, remembered in settings, dismissed by the action or GOT IT. */

function memory(seen: string[] = []): CoachMarkMemory & { updates: number } {
  const settings = signal({ coachMarksSeen: Object.freeze([...seen]) as readonly string[] });
  const mem = {
    updates: 0,
    settings,
    update(patch: { coachMarksSeen?: readonly string[] }) {
      mem.updates++;
      if (patch.coachMarksSeen) settings.value = { coachMarksSeen: patch.coachMarksSeen };
    },
  };
  return mem;
}

function setup(mem: CoachMarkMemory, concept = 'lay-egg') {
  const target = document.createElement('button');
  target.textContent = 'LAY EGG';
  const action = vi.fn();
  target.addEventListener('click', action);
  document.body.appendChild(target);
  const outside = vi.fn();
  document.body.addEventListener('click', outside);
  const view = render(<CoachMark concept={concept} text="Tap to lay an egg." target={target} memory={mem} />);
  const mark = () => view.container.querySelector('[data-coach-mark]');
  return { target, action, outside, view, mark, done: () => document.body.removeEventListener('click', outside) };
}

describe('CoachMark', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('shows one line pointing at its target and is announced politely', () => {
    const t = setup(memory());
    expect(t.mark()).not.toBeNull();
    expect(t.mark()!.textContent).toContain('Tap to lay an egg.');
    const live = t.view.container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('Tap to lay an egg.');
    t.done();
  });

  it('is not shown for a concept already seen', () => {
    const t = setup(memory(['lay-egg']));
    expect(t.mark()).toBeNull();
    t.done();
  });

  it('GOT IT dismisses it, remembers the concept and consumes the tap', () => {
    const mem = memory();
    const t = setup(mem);
    fireEvent.click(t.view.getByText(/GOT IT/));
    expect(t.mark()).toBeNull();
    expect(mem.settings.value.coachMarksSeen).toContain('lay-egg');
    expect(t.outside).not.toHaveBeenCalled();
    expect(t.action).not.toHaveBeenCalled();
    t.done();
  });

  it('performing the pointed-at action dismisses it and remembers the concept', () => {
    const mem = memory();
    const t = setup(mem);
    act(() => t.target.click());
    expect(t.action).toHaveBeenCalledTimes(1);
    expect(t.mark()).toBeNull();
    expect(mem.settings.value.coachMarksSeen).toContain('lay-egg');
    t.done();
  });

  it('remembers each concept once, keeping the others', () => {
    const mem = memory(['assign']);
    const t = setup(mem);
    fireEvent.click(t.view.getByText(/GOT IT/));
    expect([...mem.settings.value.coachMarksSeen].sort()).toEqual(['assign', 'lay-egg']);
    act(() => t.target.click());
    expect(mem.updates).toBe(1);
    t.done();
  });

  it('a tap elsewhere does not dismiss it', () => {
    const t = setup(memory());
    const other = document.createElement('div');
    document.body.appendChild(other);
    act(() => other.click());
    expect(t.mark()).not.toBeNull();
    t.done();
  });

  it('hides its box drawing from assistive tech; GOT IT is a real button', () => {
    const t = setup(memory());
    const got = t.view.getByText(/GOT IT/).closest('button');
    expect(got).not.toBeNull();
    expect(got!.getAttribute('aria-label') ?? got!.textContent).toMatch(/got it/i);
    t.done();
  });

  it('sits below its target, or above it when the target is in the lower half of the screen (Story 8.10: LAY EGG)', () => {
    const place = (top: number) => {
      const target = document.createElement('button');
      document.body.appendChild(target);
      target.getBoundingClientRect = () => ({ top, left: 10, width: 100, height: 40, bottom: top + 40, right: 110, x: 10, y: top, toJSON: () => ({}) });
      const view = render(<CoachMark concept="lay-egg" text="Tap to lay an egg." target={target} memory={memory()} />);
      const caption = view.container.querySelector<HTMLElement>('.coach-mark__caption')!;
      const out = { top: caption.style.top, bottom: caption.style.bottom };
      cleanup();
      target.remove();
      return out;
    };
    const vh = window.innerHeight;
    const high = place(Math.floor(vh * 0.1));
    expect(high.top).not.toBe('');
    expect(high.bottom).toBe('');
    const low = place(Math.floor(vh * 0.8));
    // Anchored to the target's top edge from below, so the caption never leaves the screen.
    expect(low.top).toBe('');
    expect(parseFloat(low.bottom)).toBeGreaterThan(vh - Math.floor(vh * 0.8) - 1);
  });
});
