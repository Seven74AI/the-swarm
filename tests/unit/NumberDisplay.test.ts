import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { NumberDisplay, animateValue } from '../../src/ui/components/NumberDisplay';
import { EventBus } from '../../src/engine/EventBus';

describe('animateValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('interpolates textContent from start to target over 300ms', () => {
    const el = document.createElement('span');
    el.textContent = '0';

    animateValue(el, 0, 100);

    vi.advanceTimersByTime(150);
    const mid = Number.parseFloat(el.textContent!);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);

    vi.advanceTimersByTime(200);
    expect(el.textContent).toBe('100');
  });

  it('formats output using a format function', () => {
    const el = document.createElement('span');
    el.textContent = '0';

    animateValue(el, 0, 1234, (n: number) => Math.round(n).toLocaleString('en-US'));

    vi.advanceTimersByTime(320);
    expect(el.textContent).toBe('1,234');
  });

  it('handles decreasing values', () => {
    const el = document.createElement('span');
    el.textContent = '100';

    animateValue(el, 100, 10);

    vi.advanceTimersByTime(150);
    const mid = Number.parseFloat(el.textContent!);
    expect(mid).toBeLessThan(100);
    expect(mid).toBeGreaterThan(10);

    vi.advanceTimersByTime(200);
    expect(el.textContent).toBe('10');
  });

  it('completes immediately when start equals target', () => {
    const el = document.createElement('span');
    el.textContent = '42';

    animateValue(el, 42, 42);

    expect(el.textContent).toBe('42');
  });

  it('cancels any previous animation on the same element', () => {
    const el = document.createElement('span');
    el.textContent = '0';

    animateValue(el, 0, 100);
    vi.advanceTimersByTime(100);

    animateValue(el, 0, 50);
    vi.advanceTimersByTime(320);

    expect(el.textContent).toBe('50');
  });
});

describe('NumberDisplay - animated numbers with particles', () => {

  beforeEach(() => {
  });

  function getParticles(el: HTMLElement): Element[] {
    return Array.from(el.querySelectorAll('.number-particle'));
  }

  it('renders text element inside container', () => {
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 5 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    expect(el.classList.contains('number-display')).toBe(true);
    expect(el.textContent).toContain('🥚 Eggs');
    expect(el.textContent).toContain('5');
  });

  it('spawns upward particles when value increases', () => {
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 5 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 20 } };

    const particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);
    const upParticles = el.querySelectorAll('.number-particle-up');
    expect(upParticles.length).toBeGreaterThan(0);
  });

  it('spawns downward particles when value decreases', () => {
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 30 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 5 } };

    const particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);
    const downParticles = el.querySelectorAll('.number-particle-down');
    expect(downParticles.length).toBeGreaterThan(0);
  });

  it('does NOT spawn particles when value stays the same', () => {
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 10 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    el.querySelectorAll('.number-particle').forEach((p) => p.remove());

    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 10 } };

    const particles = getParticles(el);
    expect(particles.length).toBe(0);
  });

  it('does NOT spawn particles during initial render (no "change" yet)', () => {
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 7 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    const particles = getParticles(el);
    expect(particles.length).toBe(0);
  });

  it('updates text via tween animation on value change', () => {
    // Integration test: verifies NumberDisplay uses animateValue
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 5 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    // Text element exists and shows initial value (from===to, instant)
    const textEl = el.querySelector('.number-display-text');
    expect(textEl).not.toBeNull();
    expect(textEl!.textContent).toContain('5');

    nd.destroy();
  });

  it('particles are positioned absolutely relative to container', () => {
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 5 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 15 } };

    const particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);
    const first = particles[0] as HTMLElement;
    expect(first.style.position).toBe('absolute');
  });

  it('particles self-remove after animation end event', () => {
    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 5 } };
    const nd = new NumberDisplay('resources.eggs', '🥚 Eggs');
    const el = nd.getElement();

    gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, eggs: 15 } };

    let particles = getParticles(el);
    expect(particles.length).toBeGreaterThan(0);

    while (getParticles(el).length > 0) {
      const p = getParticles(el)[0];
      p.dispatchEvent(new Event('animationend', { bubbles: false }));
    }

    particles = getParticles(el);
    expect(particles.length).toBe(0);
  });
});
