import { formatNumber } from '../../utils/format';
import type { Store } from '../../state/Store';

/** Maximum particles spawned per update to maintain 60 FPS */
const MAX_PARTICLES = 8;

/**
 * Displays a single numeric value with a label.
 * Spawns particle effects when values change:
 * - Increase → particles fly upward (green tint)
 * - Decrease → particles fall downward (red tint)
 * Subscribes to Store for automatic updates.
 */
export class NumberDisplay {
  private el: HTMLSpanElement;
  private textEl: HTMLSpanElement;
  private prevValue: number;

  constructor(
    private store: Store,
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

    const initial = store.read(path) as number;
    this.prevValue = initial;
    this.renderText(initial);
    this.el.setAttribute('data-stat', this.path);

    store.subscribe(path, (value) => this.render(value as number));
  }

  private render(value: number): void {
    const delta = value - this.prevValue;

    this.renderText(value);

    if (delta !== 0) {
      this.spawnParticles(delta);
    }

    this.prevValue = value;
  }

  private renderText(value: number): void {
    this.textEl.textContent = `${this.label}: ${formatNumber(value)}`;
  }

  /**
   * Spawn DOM-based particles that animate based on the delta sign.
   * Particles are small spans positioned absolutely within the container.
   */
  private spawnParticles(delta: number): void {
    const direction = delta > 0 ? 'up' : 'down';
    const count = Math.min(
      Math.max(1, Math.floor(Math.log10(Math.abs(delta)) + 1)),
      MAX_PARTICLES,
    );

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.className = `number-particle number-particle-${direction}`;

      // Randomize horizontal offset within the container width
      const offsetX = Math.random() * 100;
      // Slight vertical offset for visual variety
      const offsetY = direction === 'up'
        ? Math.random() * 10
        : Math.random() * 5;
      // Stagger animation start
      const delay = Math.random() * 0.15;

      particle.style.cssText = [
        `position: absolute`,
        `left: ${offsetX}%`,
        `bottom: ${direction === 'up' ? offsetY : 'auto'}%`,
        `top: ${direction === 'down' ? offsetY : 'auto'}%`,
        `animation-delay: ${delay}s`,
      ].join('; ');

      // Self-remove after animation completes
      particle.addEventListener('animationend', () => {
        particle.remove();
      }, { once: true });

      this.el.appendChild(particle);
    }
  }

  getElement(): HTMLSpanElement {
    return this.el;
  }
}
