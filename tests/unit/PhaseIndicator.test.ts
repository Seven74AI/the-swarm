import { describe, it, expect, beforeEach } from 'vitest';
import { PhaseIndicator } from '../../src/ui/panels/PhaseIndicator';
import { EventBus } from '../../src/engine/EventBus';
import { Phase } from '../../src/phases/phases';

describe('PhaseIndicator', () => {
  let bus: EventBus;
  let indicator: PhaseIndicator;

  beforeEach(() => {
    bus = new EventBus();
    indicator = new PhaseIndicator(bus);
  });

  it('displays the initial phase name', () => {
    const el = indicator.getElement();
    expect(el.textContent).toContain('The Lonely Queen');
  });

  it('has phase-indicator id', () => {
    const el = indicator.getElement();
    expect(el.id).toBe('phase-indicator');
  });

  it('updates display when phase_changed event fires', () => {
    bus.emit('phase_changed', { phase: Phase.COLONY });
    const el = indicator.getElement();
    expect(el.textContent).toContain('The Colony');
  });

  it('defaults to egg_laying phase styling', () => {
    const el = indicator.getElement();
    expect(el.className).toContain('phase-indicator');
  });

  it('changes to colony class on phase transition', () => {
    bus.emit('phase_changed', { phase: Phase.COLONY });
    const el = indicator.getElement();
    expect(el.className).toContain('phase-colony');
  });

  it('sets tooltip on Space phase transition explaining new mechanics', () => {
    bus.emit('phase_changed', { phase: Phase.SPACE });
    const el = indicator.getElement();
    expect(el.getAttribute('data-tooltip')).toContain('Space');
    expect(el.getAttribute('data-tooltip')).toContain('spaceship');
  });

  it('sets tooltip on Transcendence phase transition explaining victory', () => {
    bus.emit('phase_changed', { phase: Phase.TRANSCENDENCE });
    const el = indicator.getElement();
    expect(el.getAttribute('data-tooltip')).toContain('Transcendence');
    expect(el.getAttribute('data-tooltip')).toContain('Victory');
  });

  it('removes tooltip on earlier phases (egg_laying, colony, combat, expansion)', () => {
    // Set tooltip first by going to Space
    bus.emit('phase_changed', { phase: Phase.SPACE });
    // Then go to colony
    bus.emit('phase_changed', { phase: Phase.COLONY });
    const el = indicator.getElement();
    expect(el.hasAttribute('data-tooltip')).toBe(false);
  });
});
