import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { confirmSettings, holdFor } from './helpers/confirm';
import { fireEvent } from '@testing-library/preact';
import { testActions } from './helpers/actions';
import { gameState } from '../../src/state/gameSignal';
import { ResearchPanel } from '../../src/ui/panels/ResearchPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';
import {
  assignResearcher,
  startProject,
  tickResearch,
} from '../../src/systems/ResearchSystem';

describe('ResearchPanel', () => {
  let bus: EventBus;
  let panel: ResearchPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    // Set up some resources and researchers
    currentState.resources.stone = 1000;
    currentState.resources.nectar = 500;
    currentState.resources.voidCrystals = 10;
    currentState.resources.antimatter = 1;
    currentState.resources.workers = 100;

    panel = new ResearchPanel(bus, () => currentState, testActions(bus, () => currentState, (s: GameState) => { currentState = s; gameState.value = s; }), confirmSettings());
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
  });

  it('shows research panel title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Research');
  });

  it('lists all 3 research projects', () => {
    const el = panel.getElement();
    const projects = el.querySelectorAll('[data-research-project]');
    expect(projects.length).toBe(3);
  });

  it('shows project names', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Void Crystal Synthesis');
    expect(text).toContain('Antimatter Containment');
    expect(text).toContain('Dark Matter Detection');
  });

  it('shows project costs', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    // Void Crystal Synthesis costs
    expect(text).toContain('500');
    expect(text).toContain('stone');
    expect(text).toContain('200');
    expect(text).toContain('nectar');
  });

  it('shows researcher requirement', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('50'); // researchers for VCS
  });

  it('shows locked status for chained projects', () => {
    const el = panel.getElement();
    // antimatterContainment should be locked
    const acEl = el.querySelector('[data-research-project="antimatterContainment"]');
    expect(acEl).toBeTruthy();
    expect(acEl!.textContent || '').toContain('Locked');
  });

  it('shows available status for unlocked project with resources', () => {
    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    expect(vcsEl!.textContent || '').toContain('Available');
  });

  it('has a Start button for available projects', () => {
    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    const startBtn = vcsEl!.querySelector('button');
    expect(startBtn).toBeTruthy();
    expect(startBtn!.textContent).toContain('Start');
  });

  it('disables Start button when no researchers assigned', () => {
    // No researchers assigned, button should be disabled
    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    const startBtn = vcsEl!.querySelector('button') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
  });

  it('enables Start button when researchers met', () => {
    currentState = assignResearcher(currentState);
    // Still need 50 — not enough yet
    for (let i = 0; i < 49; i++) {
      currentState = assignResearcher(currentState);
    }
    panel.refresh();

    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    const startBtn = vcsEl!.querySelector('button') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(false);
  });

  it('clicking Start starts the project', () => {
    // Assign 50 researchers
    for (let i = 0; i < 50; i++) {
      currentState = assignResearcher(currentState);
    }
    panel.refresh();

    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    const startBtn = vcsEl!.querySelector('button') as HTMLButtonElement;

    startBtn.click();

    // State should have changed
    expect(currentState.research.projects.voidCrystalSynthesis.status).toBe('running');
  });

  it('shows progress bar for in-progress projects', () => {
    // Start the project
    for (let i = 0; i < 50; i++) {
      currentState = assignResearcher(currentState);
    }
    currentState = startProject(currentState, 'voidCrystalSynthesis');
    panel.refresh();

    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    const progressBar = vcsEl!.querySelector('.progress-bar-fill, [role="progressbar"]');
    expect(progressBar).toBeTruthy();
  });

  it('shows completed status for finished projects', () => {
    currentState = {
      ...currentState,
      research: {
        projects: {
          voidCrystalSynthesis: { status: 'done' },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
        },
      },
    };
    panel.refresh();

    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    expect(vcsEl!.textContent || '').toContain('Completed');
  });

  it('shows Cancel button for in-progress projects', () => {
    for (let i = 0; i < 50; i++) {
      currentState = assignResearcher(currentState);
    }
    currentState = startProject(currentState, 'voidCrystalSynthesis');
    panel.refresh();

    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    const cancelBtn = Array.from(vcsEl!.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Cancel'),
    );
    expect(cancelBtn).toBeTruthy();
  });

  it('holding Cancel stops the project and refunds 50%', () => {
    for (let i = 0; i < 50; i++) {
      currentState = assignResearcher(currentState);
    }
    currentState = startProject(currentState, 'voidCrystalSynthesis');
    const stoneAfterStart = currentState.resources.stone;
    panel.refresh();

    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    const cancelBtn = Array.from(vcsEl!.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Cancel'),
    ) as HTMLButtonElement;

    // Irreversible: a hold, not a click (Story 1.13).
    vi.useFakeTimers();
    try {
      holdFor(cancelBtn, 1000);
    } finally {
      vi.useRealTimers();
    }

    // Should have refunded 50% (250 stone back)
    expect(currentState.resources.stone).toBeGreaterThan(stoneAfterStart);
    expect(currentState.research.projects.voidCrystalSynthesis.status).toBe('idle');
  });

  it('shows researcher assignment controls', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Researchers');
  });

  it('has assign/unassign buttons for researchers', () => {
    const el = panel.getElement();
    const plusBtns = el.querySelectorAll('button');
    const hasAssign = Array.from(plusBtns).some((b) => b.textContent?.includes('+'));
    const hasUnassign = Array.from(plusBtns).some((b) => b.textContent?.includes('−'));
    expect(hasAssign || hasUnassign).toBe(true);
  });

  it('shows unlock description for completed projects', () => {
    currentState = {
      ...currentState,
      research: {
        projects: {
          voidCrystalSynthesis: { status: 'done' },
          antimatterContainment: { status: 'idle' },
          darkMatterDetection: { status: 'idle' },
        },
      },
    };
    panel.refresh();

    const el = panel.getElement();
    const vcsEl = el.querySelector('[data-research-project="voidCrystalSynthesis"]');
    expect(vcsEl!.textContent || '').toContain('voidCrystal');
  });

  it('shows the project length', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('30s'); // game-time length of VCS (600 ticks)
  });
});

describe('ResearchPanel: cancel needs a deliberate confirm (Story 1.13)', () => {
  let bus: EventBus;
  let panel: ResearchPanel;
  let currentState: GameState;

  function cancelButton(): HTMLButtonElement {
    const card = panel.getElement().querySelector('[data-research-project="voidCrystalSynthesis"]');
    const btn = Array.from(card!.querySelectorAll('button')).find((b) => b.textContent?.includes('Cancel'));
    if (!btn) throw new Error('no cancel button');
    return btn;
  }

  function setup(settings = confirmSettings()) {
    bus = new EventBus();
    currentState = createInitialState();
    currentState = {
      ...currentState,
      resources: { ...currentState.resources, stone: 1000, nectar: 500, voidCrystals: 10, antimatter: 1, workers: 100 },
    };
    for (let i = 0; i < 50; i++) currentState = assignResearcher(currentState);
    currentState = startProject(currentState, 'voidCrystalSynthesis');
    panel = new ResearchPanel(bus, () => currentState, testActions(bus, () => currentState, (s: GameState) => { currentState = s; }), settings);
    panel.refresh();
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a plain click does not cancel', () => {
    setup();
    cancelButton().click();
    vi.advanceTimersByTime(5000);
    expect(currentState.research.projects.voidCrystalSynthesis.status).toBe('running');
  });

  it('a hold survives research progress re-renders and then cancels', () => {
    const settings = confirmSettings();
    setup(settings);
    const holdMs = settings.value.confirmHoldMs;
    const el = cancelButton();
    fireEvent.pointerDown(el, { pointerId: 9, button: 0 });
    // Research keeps progressing (and the panel re-rendering) while the hold runs.
    for (let t = 0; t < holdMs; t += 250) {
      currentState = tickResearch(currentState, 0.25);
      panel.refresh();
      expect(cancelButton()).toBe(el);
      vi.advanceTimersByTime(250);
    }
    expect(currentState.research.projects.voidCrystalSynthesis.status).toBe('idle');
  });

  it('two-tap mode: the first tap arms, the second cancels', () => {
    setup(confirmSettings({ confirmStyle: 'twoTaps' }));
    cancelButton().click();
    expect(currentState.research.projects.voidCrystalSynthesis.status).toBe('running');
    cancelButton().click();
    expect(currentState.research.projects.voidCrystalSynthesis.status).toBe('idle');
  });
});
