import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { ClickButton } from '../../src/ui/components/ClickButton';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SaveManager } from '../../src/persistence/SaveManager';
import type { GameState } from '../../src/state/GameState';

describe('ClickButton - floating "+N" particles', () => {
  let container: HTMLElement;
  let bus: EventBus;
  let resourceSystem: ResourceSystem;
  let saveManager: SaveManager;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    bus = new EventBus();

    // Setup minimal game state for testing
    gameState.value = {
      resources: { eggs: 0, larvae: 0, workers: 0, food: 100 },
      stats: { totalClicks: 0, playTimeMs: 0 },
      upgrades: { click_power: 0 },
      eggPipeline: { count: 0, progress: 0 },
      larvaPipeline: { count: 0, progress: 0 },
      assignedWorkers: { food: 0, hunt: 0, build: 0, explore: 0 },
      buildings: { hatchery: { count: 0 } },
      territory: { tiles: [] },
      expeditions: [],
      soldiers: { ants: 0, level: 1 },
      enemies: [],
      battles: [],
      mapGrids: { current: '', discovered: [] },
      exploration: { activeExpeditions: [] },
      spaceships: {},
      spaceshipResources: {},
      phase: 'colony',
      saveVersion: 0,
    } as unknown as GameState;

    resourceSystem = new ResourceSystem(bus);
    saveManager = {
      save: vi.fn(),
      load: vi.fn(),
      getLastSaveTime: vi.fn().mockReturnValue(0),
    } as unknown as SaveManager;
  });

  afterEach(() => {
    // Clean up burst particles (appended to body, not container)
    document.querySelectorAll('.burst-particle').forEach((p) => p.remove());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  function getClickParticles(): Element[] {
    return Array.from(document.querySelectorAll('.click-particle'));
  }

  it('spawns a floating "+1 🥚" particle on click', () => {
    const cb = new ClickButton(
      bus, resourceSystem, saveManager,
      () => gameState.value as GameState,
      (s: GameState) => { gameState.value = s; },
    );

    const el = cb.getElement();
    container.appendChild(el);

    const button = el.querySelector('#click-egg') as HTMLButtonElement;
    expect(button).not.toBeNull();

    // Before click, no particles
    expect(getClickParticles().length).toBe(0);

    // Click the button
    button.click();

    // After click, at least one particle should be spawned
    const particles = getClickParticles();
    expect(particles.length).toBeGreaterThan(0);
    expect(particles[0].textContent).toContain('+1');
    expect(particles[0].textContent).toContain('🥚');
  });

  it('particle has CSS class click-particle', () => {
    const cb = new ClickButton(
      bus, resourceSystem, saveManager,
      () => gameState.value as GameState,
      (s: GameState) => { gameState.value = s; },
    );

    const el = cb.getElement();
    container.appendChild(el);

    const button = el.querySelector('#click-egg') as HTMLButtonElement;
    button.click();

    const particles = getClickParticles();
    expect(particles.length).toBeGreaterThan(0);
    expect(particles[0].classList.contains('click-particle')).toBe(true);
  });

  it('particle self-removes after animation end', () => {
    const cb = new ClickButton(
      bus, resourceSystem, saveManager,
      () => gameState.value as GameState,
      (s: GameState) => { gameState.value = s; },
    );

    const el = cb.getElement();
    container.appendChild(el);

    const button = el.querySelector('#click-egg') as HTMLButtonElement;
    button.click();

    let particles = getClickParticles();
    expect(particles.length).toBeGreaterThan(0);

    // Simulate animation end
    particles.forEach((p) => {
      p.dispatchEvent(new Event('animationend', { bubbles: false }));
    });

    particles = getClickParticles();
    expect(particles.length).toBe(0);
  });

  it('multiple clicks spawn multiple particles', () => {
    const cb = new ClickButton(
      bus, resourceSystem, saveManager,
      () => gameState.value as GameState,
      (s: GameState) => { gameState.value = s; },
    );

    const el = cb.getElement();
    container.appendChild(el);

    const button = el.querySelector('#click-egg') as HTMLButtonElement;

    button.click();
    button.click();
    button.click();

    const particles = getClickParticles();
    expect(particles.length).toBe(3);
  });

  it('spawns burst particles on click', () => {
    const cb = new ClickButton(
      bus, resourceSystem, saveManager,
      () => gameState.value as GameState,
      (s: GameState) => { gameState.value = s; },
    );

    const el = cb.getElement();
    container.appendChild(el);

    const button = el.querySelector('#click-egg') as HTMLButtonElement;

    // Before click, no burst particles
    const beforeBurst = document.querySelectorAll('.burst-particle');
    expect(beforeBurst.length).toBe(0);

    button.click();

    // After click, burst particles should be spawned
    const burstParticles = document.querySelectorAll('.burst-particle');
    expect(burstParticles.length).toBeGreaterThan(0);

    // Each burst particle should have the correct class
    burstParticles.forEach((p) => {
      expect(p.classList.contains('burst-particle')).toBe(true);
    });
  });

  it('burst particles self-remove after animation end', () => {
    const cb = new ClickButton(
      bus, resourceSystem, saveManager,
      () => gameState.value as GameState,
      (s: GameState) => { gameState.value = s; },
    );

    const el = cb.getElement();
    container.appendChild(el);

    const button = el.querySelector('#click-egg') as HTMLButtonElement;
    button.click();

    const burstParticles = document.querySelectorAll('.burst-particle');
    expect(burstParticles.length).toBeGreaterThan(0);

    // Simulate animation end on all burst particles
    burstParticles.forEach((p) => {
      p.dispatchEvent(new Event('animationend', { bubbles: false }));
    });

    // Particles should be removed
    const afterBurst = document.querySelectorAll('.burst-particle');
    expect(afterBurst.length).toBe(0);
  });
});
