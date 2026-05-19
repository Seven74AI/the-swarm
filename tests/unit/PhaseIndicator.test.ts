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
});
