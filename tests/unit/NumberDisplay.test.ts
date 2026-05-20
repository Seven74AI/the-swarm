import { describe, it, expect, beforeEach } from 'vitest';
import { NumberDisplay } from '../../src/ui/components/NumberDisplay';
import { Store } from '../../src/state/Store';
import { StateManager } from '../../src/state/StateManager';
import { EventBus } from '../../src/engine/EventBus';

describe('NumberDisplay - animated numbers with particles', () => {
  let bus: EventBus;
  let manager: StateManager;
  let store: Store;

  beforeEach(() => {
    bus = new EventBus();
    manager = new StateManager(bus);
    store = new Store(manager);
  });

  function getParticles(el: HTMLElement): Element[] {
    return Array.from(el.querySelectorAll('.number-particle'));
  }

  it('renders text element inside container', () => {
    manager.update({ resources: { eggs: 5 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    expect(el.classList.contains('number-display')).toBe(true);
    expect(el.textContent).toContain('🥚 Eggs');
    expect(el.textContent).toContain('5');
  });

  it('spawns upward particles when value increases', () => {
    manager.update({ resources: { eggs: 5 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    // Update: increase value
    manager.update({ resources: { eggs: 20 } });

    const particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);
    // Upward particles fly up (translateY negative direction)
    const upParticles = el.querySelectorAll('.number-particle-up');
    expect(upParticles.length).toBeGreaterThan(0);
  });

  it('spawns downward particles when value decreases', () => {
    manager.update({ resources: { eggs: 30 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    // Update: decrease value
    manager.update({ resources: { eggs: 5 } });

    const particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);
    const downParticles = el.querySelectorAll('.number-particle-down');
    expect(downParticles.length).toBeGreaterThan(0);
  });

  it('does NOT spawn particles when value stays the same', () => {
    manager.update({ resources: { eggs: 10 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    // Clear any particles from initial render
    el.querySelectorAll('.number-particle').forEach((p) => p.remove());

    // Update: same value
    manager.update({ resources: { eggs: 10 } });

    const particles = getParticles(el);
    expect(particles.length).toBe(0);
  });

  it('does NOT spawn particles during initial render (no "change" yet)', () => {
    manager.update({ resources: { eggs: 7 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    const particles = getParticles(el);
    expect(particles.length).toBe(0);
  });

  it('updates displayed text when value changes', () => {
    manager.update({ resources: { eggs: 5 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');

    manager.update({ resources: { eggs: 12345 } });

    const textEl = nd.getElement().querySelector('.number-display-text');
    expect(textEl).not.toBeNull();
    expect(textEl!.textContent).toContain('12.35K');
  });

  it('particles are positioned absolutely relative to container', () => {
    manager.update({ resources: { eggs: 5 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    manager.update({ resources: { eggs: 15 } });

    const particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);
    const first = particles[0] as HTMLElement;
    // Particles should be absolutely positioned so they animate over the text
    expect(first.style.position).toBe('absolute');
  });

  it('particles self-remove after animation end event', () => {
    manager.update({ resources: { eggs: 5 } });
    const nd = new NumberDisplay(store, 'resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    manager.update({ resources: { eggs: 15 } });

    let particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);

    // Simulate animation ending on each particle
    while (getParticles(el).length > 0) {
      const p = getParticles(el)[0];
      p.dispatchEvent(new Event('animationend', { bubbles: false }));
    }

    particles = getParticles(el);
    expect(particles.length).toBe(0);
  });
});
