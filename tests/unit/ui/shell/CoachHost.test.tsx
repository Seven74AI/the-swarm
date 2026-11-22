import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { CoachHost, createCoach } from '../../../../src/ui/shell/CoachHost';
import type { CoachMarkMemory } from '../../../../src/ui/primitives/CoachMark';

/** Story 8.10: once the queen wakes, a coach mark points at LAY EGG (one concept, once ever). */

function memory(seen: string[] = []): CoachMarkMemory {
  const settings = signal({ coachMarksSeen: Object.freeze([...seen]) as readonly string[] });
  return {
    settings,
    update(patch) {
      settings.value = { coachMarksSeen: patch.coachMarksSeen };
    },
  };
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function setup(seen: string[] = []) {
  const target = document.createElement('button');
  target.id = 'click-egg';
  document.body.appendChild(target);
  const coach = createCoach();
  render(<CoachHost coach={coach} memory={memory(seen)} />);
  return { coach, target };
}

describe('CoachHost', () => {
  it('draws nothing until a coach mark is asked for, then points at its target', () => {
    const { coach } = setup();
    expect(document.querySelector('[data-coach-mark]')).toBeNull();
    act(() => coach.show({ concept: 'lay-egg', text: 'Tap LAY EGG.', target: '#click-egg' }));
    expect(document.querySelector('[data-coach-mark="lay-egg"]')).not.toBeNull();
    expect(document.querySelector('.coach-mark__box')).not.toBeNull();
  });

  it('draws nothing for a concept already seen, or a target that is not there', () => {
    const { coach } = setup(['lay-egg']);
    act(() => coach.show({ concept: 'lay-egg', text: 'Tap LAY EGG.', target: '#click-egg' }));
    expect(document.querySelector('[data-coach-mark]')).toBeNull();
    act(() => coach.show({ concept: 'other', text: 'Tap it.', target: '#nowhere' }));
    expect(document.querySelector('[data-coach-mark]')).toBeNull();
  });

  it('the action it points at dismisses it', () => {
    const { coach, target } = setup();
    act(() => coach.show({ concept: 'lay-egg', text: 'Tap LAY EGG.', target: '#click-egg' }));
    act(() => target.click());
    expect(document.querySelector('[data-coach-mark]')).toBeNull();
  });
});
