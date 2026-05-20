import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import { formatNumber } from '../../utils/format';

/** Maximum particles spawned per update to maintain 60 FPS */
const MAX_PARTICLES = 8;
/** Hard cap on total particle elements to prevent memory leaks */
const MAX_TOTAL_PARTICLES = 16;

/** Default tween duration in milliseconds */
const ANIMATION_DURATION = 300;

/** Map from element to active animation ID for cancellation */
const activeAnimations = new WeakMap<HTMLElement, number>();

/**
 * Interpolate an element's textContent from one numeric value to another
 * over ~300ms using requestAnimationFrame.
 * Cancels any previous animation on the same element.
 *
 * @param el           Element whose textContent will be animated.
 * @param from         Starting numeric value.
 * @param to           Target numeric value.
 * @param formatFn     Optional formatter — defaults to rounding.
 */
export function animateValue(
  el: HTMLElement,
  from: number,
  to: number,
  formatFn: (n: number) => string = (n: number) => String(Math.round(n)),
): void {
  // Cancel any previous animation on this element
  const existing = activeAnimations.get(el);
  if (existing !== undefined) {
    cancelAnimationFrame(existing);
  }

  if (from === to) {
    el.textContent = formatFn(to);
    return;
  }

  const startTime = Date.now();
  const duration = ANIMATION_DURATION;

  function step(): void {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out quad for smooth deceleration
    const eased = 1 - (1 - progress) * (1 - progress);
    const current = from + (to - from) * eased;

    el.textContent = formatFn(current);

    if (progress < 1) {
      const id = requestAnimationFrame(step);
      activeAnimations.set(el, id);
    } else {
      // Ensure exact final value
      el.textContent = formatFn(to);
      activeAnimations.delete(el);
    }
  }

  const id = requestAnimationFrame(step);
  activeAnimations.set(el, id);
}

/**
 * Displays a single numeric value with a label.
 * Uses @preact/signals-core effect() for automatic, granular updates.
 * Only re-renders when THIS specific value changes.
 */
export class NumberDisplay {
  private el: HTMLSpanElement;
  private textEl: HTMLSpanElement;
  private prevValue: number;
  private dispose: () => void;

  constructor(
    private path: string,
    private label: string,
  ) {
    this.el = document.createElement('span');
    this.el.className = 'number-display';
    this.el.style.position = 'relative';
    this.el.style.display = 'inline-block';

    this.textEl = document.createElement('span');
    this.textEl.className = 'number-display-text';
    this.el.appendChild(this.textEl);

    // Read initial value by walking the path
    const initial = getByPath(gameState.value, path) as number;
    this.prevValue = initial;
    this.renderText(initial);
    this.el.setAttribute('data-stat', this.path);

    // Reactive: auto-track this specific path
    this.dispose = effect(() => {
      const value = getByPath(gameState.value, path) as number;
      const delta = value - this.prevValue;
      this.renderText(value);
      if (delta !== 0) {
        this.spawnParticles(delta);
      }
      this.prevValue = value;
    });
  }

  private renderText(value: number): void {
    // Use tween animation for visual smoothness
    animateValue(
      this.textEl,
      this.prevValue,
      value,
      (n: number) => `${this.label}: ${formatNumber(n)}`,
    );
  }

  /** Clean up orphaned particle elements (safety net) */
  private cleanupOrphanParticles(): void {
    const particles = this.el.querySelectorAll('.number-particle');
    if (particles.length > MAX_TOTAL_PARTICLES) {
      for (let i = 0; i < particles.length - MAX_TOTAL_PARTICLES; i++) {
        particles[i].remove();
      }
    }
  }

  private spawnParticles(delta: number): void {
    this.cleanupOrphanParticles();

    const direction = delta > 0 ? 'up' : 'down';
    const count = Math.min(
      Math.max(1, Math.floor(Math.log10(Math.abs(delta)) + 1)),
      MAX_PARTICLES,
    );

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.className = `number-particle number-particle-${direction}`;

      const offsetX = Math.random() * 100;
      const offsetY = direction === 'up'
        ? Math.random() * 10
        : Math.random() * 5;
      const delay = Math.random() * 0.15;

      particle.style.cssText = [
        `position: absolute`,
        `left: ${offsetX}%`,
        `bottom: ${direction === 'up' ? offsetY : 'auto'}%`,
        `top: ${direction === 'down' ? offsetY : 'auto'}%`,
        `animation-delay: ${delay}s`,
      ].join('; ');

      particle.addEventListener('animationend', () => {
        particle.remove();
      }, { once: true });

      // Safety net: force-remove after 2s
      setTimeout(() => {
        if (particle.isConnected) particle.remove();
      }, 2000);

      this.el.appendChild(particle);
    }
  }

  /** Stop the effect when this display is removed */
  destroy(): void {
    this.dispose();
  }

  getElement(): HTMLSpanElement {
    return this.el;
  }
}

/** Read a nested value from an object using dot-notation. */
function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
