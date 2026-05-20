import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { DecisionPopup } from '../../src/ui/components/DecisionPopup';
import type { DecisionEvent } from '../../src/systems/DecisionSystem';

describe('DecisionPopup', () => {
  let bus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    bus = new EventBus();
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.useRealTimers();
  });

  const beetleEvent: DecisionEvent = {
    type: 'beetle',
    title: 'Beetle Sighting',
    description: 'A large beetle was spotted.',
    choices: [
      { label: 'Collect', description: '+food, risk worker' },
      { label: 'Ignore', description: 'No change' },
    ],
  };

  it('renders in bottom-right position', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    expect(el.style.position).toBe('fixed');
    expect(el.style.bottom).toBe('20px');
    expect(el.style.right).toBe('20px');
  });

  it('shows event title and description', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    expect(el.textContent).toContain('Beetle Sighting');
    expect(el.textContent).toContain('A large beetle was spotted.');
  });

  it('renders choice buttons', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    const buttons = el.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('Collect');
    expect(buttons[1].textContent).toContain('Ignore');
  });

  it('emits decision_chosen event on button click', () => {
    let chosen: any = null;
    bus.subscribe('decision_chosen', (p) => (chosen = p));

    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    const collectBtn = el.querySelector('button');
    collectBtn!.click();

    expect(chosen).not.toBeNull();
    expect(chosen?.type).toBe('beetle');
    expect(chosen?.choice).toBe('Collect');
  });

  it('hides popup after choice is made', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    const btn = el.querySelector('button');
    btn!.click();

    expect(el.style.display).toBe('none');
  });

  it('auto-dismisses after 30 seconds', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    expect(el.style.display).not.toBe('none');

    // Advance 30 seconds
    vi.advanceTimersByTime(30_000);

    // After timeout, should be hidden
    expect(el.style.display).toBe('none');
  });

  it('does not dismiss before 30 seconds', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    vi.advanceTimersByTime(10_000);

    expect(el.style.display).not.toBe('none');
  });

  it('cancels auto-dismiss timer when choice is made early', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    const btn = el.querySelector('button');
    btn!.click();

    // Advance past 30s — should still be hidden (already dismissed by choice)
    vi.advanceTimersByTime(30_000);
    expect(el.style.display).toBe('none');
  });

  it('renders 3 buttons for overcrowding event', () => {
    const overcrowdingEvent: DecisionEvent = {
      type: 'overcrowding',
      title: 'Overcrowding!',
      description: 'The nest is cramped.',
      choices: [
        { label: 'Expand', description: 'More space' },
        { label: 'Cull', description: 'Reduce pop' },
        { label: 'Wait', description: 'Hold steady' },
      ],
    };

    const popup = new DecisionPopup(bus);
    popup.show(overcrowdingEvent);
    container.appendChild(popup.getElement());

    const buttons = popup.getElement().querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toContain('Expand');
    expect(buttons[1].textContent).toContain('Cull');
    expect(buttons[2].textContent).toContain('Wait');
  });

  it('non-blocking — does not prevent background interaction', () => {
    const popup = new DecisionPopup(bus);
    popup.show(beetleEvent);
    container.appendChild(popup.getElement());

    const el = popup.getElement();
    const style = window.getComputedStyle(el);
    // Should not have a blocking overlay (pointer-events: none on background would block)
    expect(style.pointerEvents).not.toBe('none');
  });
});
