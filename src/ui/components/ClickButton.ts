import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import type { EventBus } from '../../engine/EventBus';
import type { ResourceSystem } from '../../systems/ResourceSystem';
import type { SaveManager } from '../../persistence/SaveManager';
import type { GameState } from '../../state/GameState';
import { formatNumber } from '../../utils/format';
import type { AudioSystem } from '../AudioSystem';

/** Number of burst particles spawned per click (in addition to the text particle). */
const BURST_COUNT = 8;

/** Color palette for burst particles — cycled randomly for visual variety. */
const BURST_COLORS = [
  'var(--accent-glow)',
  'var(--accent)',
  'var(--success)',
  '#ffd700',
  '#ff6b9d',
  '#7bed9f',
];

/**
 * The core "Lay Egg" button.
 * On click: calls ResourceSystem.clickEgg, updates state, triggers save.
 * Spawns floating "+N 🥚" text particle + burst of small dot particles.
 */
export class ClickButton {
  private container: HTMLDivElement;
  private button: HTMLButtonElement;
  private counter: HTMLSpanElement;
  private dispose: () => void;

  constructor(
    private bus: EventBus,
    private resourceSystem: ResourceSystem,
    private saveManager: SaveManager,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
    private audio?: AudioSystem,
  ) {
    this.container = document.createElement('div');
    this.container.className = 'click-button-container';

    this.button = document.createElement('button');
    this.button.id = 'click-egg';
    this.button.className = 'click-button btn';
    this.button.textContent = '🥚 Lay Egg';
    this.button.addEventListener('click', () => this.onClick());

    this.counter = document.createElement('span');
    this.counter.className = 'click-counter';

    this.container.appendChild(this.button);
    this.container.appendChild(this.counter);

    this.updateCounter(gameState.value.stats.totalClicks);

    // Reactive: only re-runs when totalClicks changes
    this.dispose = effect(() => {
      this.updateCounter(gameState.value.stats.totalClicks);
    });
  }

  private onClick(): void {
    const state = this.getState();
    const newState = this.resourceSystem.clickEgg(state);
    this.setState(newState);
    this.bus.emit('click:egg', {});
    this.saveManager.save(newState, newState.stats.playTimeMs);
    this.spawnClickParticle();
    this.spawnBurstParticles();
    this.audio?.play('click');
  }

  /** Spawn a floating "+1 🥚" particle near the click button */
  private spawnClickParticle(): void {
    const particle = document.createElement('span');
    particle.className = 'click-particle';
    particle.textContent = '+1 🥚';

    // Random horizontal offset for variety
    const xOffset = (Math.random() - 0.5) * 60;
    particle.style.setProperty('--click-offset-x', `${xOffset}px`);

    particle.addEventListener('animationend', () => {
      particle.remove();
    }, { once: true });

    // Safety: force-remove after animation duration + buffer
    setTimeout(() => {
      if (particle.isConnected) particle.remove();
    }, 2000);

    this.container.appendChild(particle);
  }

  private updateCounter(clicks: number): void {
    this.counter.textContent = `Clicks: ${formatNumber(clicks)}`;
  }

  /** Spawn small burst dot particles radiating from the button center. */
  private spawnBurstParticles(): void {
    const rect = this.button.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < BURST_COUNT; i++) {
      const dot = document.createElement('span');
      dot.className = 'burst-particle';

      // Random angle and distance
      const angle = (Math.PI * 2 * i) / BURST_COUNT + (Math.random() - 0.5) * 0.5;
      const distance = 30 + Math.random() * 50;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      // Random color from palette
      const color = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
      // Random size (3-7px)
      const size = 3 + Math.random() * 4;

      dot.style.cssText = [
        `position: fixed`,
        `left: ${cx + dx}px`,
        `top: ${cy + dy}px`,
        `animation-delay: ${Math.random() * 0.08}s`,
        `background: ${color}`,
        `box-shadow: 0 0 ${4 + Math.random() * 4}px ${color}`,
        `width: ${size}px`,
        `height: ${size}px`,
      ].join('; ');

      dot.addEventListener('animationend', () => {
        dot.remove();
      }, { once: true });

      // Safety net: force-remove after animation duration
      setTimeout(() => {
        if (dot.isConnected) dot.remove();
      }, 1500);

      document.body.appendChild(dot);
    }
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
