import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { confirmSettings, holdFor } from './helpers/confirm';
import { testActions } from './helpers/actions';
import { gameState } from '../../src/state/gameSignal';
import { PrestigePanel } from '../../src/ui/panels/PrestigePanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { PHASE_ORDER } from '../../src/phases/phases';
import { calculateLegacyPoints, getPhaseScore } from '../../src/systems/PrestigeSystem';

describe('PrestigePanel', () => {
  let bus: EventBus;
  let panel: PrestigePanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new PrestigePanel(bus, () => currentState, testActions(bus, () => currentState, (s: GameState) => { currentState = s; }), confirmSettings());
  });

  it('creates a panel element', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
    expect(el.className).toContain('prestige-panel');
  });

  it('shows prestige title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Legacy');
    expect(text).toContain('Prestige');
  });

  it('shows current legacy points as 0 initially', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('0');
  });

  it('shows legacy points count when > 0', () => {
    currentState = {
      ...currentState,
      prestige: { count: 0, legacyPoints: 5, totalFoodProduced: 50_000, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('5');
  });

  it('shows "Legacy 0" when prestige count is 0', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toMatch(/Legacy.*?0/);
  });

  it('shows "Legacy 3" after 3 prestiges', () => {
    currentState = {
      ...currentState,
      prestige: { count: 3, legacyPoints: 12, totalFoodProduced: 500_000, totalWoodProduced: 0, totalStoneProduced: 0, totalNectarProduced: 0 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toMatch(/Legacy.*?3/);
  });

  it('has a prestige button', () => {
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige');
    expect(btn).toBeTruthy();
  });

  it('disables button when requirements are not met', () => {
    // All starting values are zero — prestige not available
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('enables button when requirements are met', () => {
    currentState = {
      ...currentState,
      buildings: {
        barracks: { level: 5, count: 0 },
        walls: { level: 5 },
        warehouse: { level: 5 },
        silk_weaving: { level: 0 },
        chitin_armory: { level: 0 },
        venom_lab: { level: 0 },
      },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-disabled')).toBeNull();
  });

  it('shows tooltip with unmet requirements when button is disabled', () => {
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    // Button should have a title attribute with unmet requirements
    const title = btn.getAttribute('title') || '';
    expect(title).toContain('barracks');
    expect(title).toContain('100K');
  });

  it('shows projected legacy points for next reset', () => {
    currentState = {
      ...currentState,
      buildings: {
        barracks: { level: 5, count: 0 },
        walls: { level: 5 },
        warehouse: { level: 5 },
        silk_weaving: { level: 0 },
        chitin_armory: { level: 0 },
        venom_lab: { level: 0 },
      },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 1_000_000_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    // Should show "Next Reset" or similar text with projected points
    expect(text).toMatch(/Next|Reset|Projected/i);
  });

  it('emits a prestige event when button is clicked (requirements met)', () => {
    currentState = {
      ...currentState,
      buildings: {
        barracks: { level: 5, count: 0 },
        walls: { level: 5 },
        warehouse: { level: 5 },
        silk_weaving: { level: 0 },
        chitin_armory: { level: 0 },
        venom_lab: { level: 0 },
      },
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
    };
    panel.refresh();
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;

    let prestigeEvent: unknown = null;
    bus.subscribe('prestige_triggered', (p) => { prestigeEvent = p; });

    vi.useFakeTimers();
    try {
      holdFor(btn, 1000);
    } finally {
      vi.useRealTimers();
    }

    expect(prestigeEvent).not.toBeNull();
  });

  it('does not emit prestige event when button is disabled', () => {
    const el = panel.getElement();
    const btn = el.querySelector('.btn-prestige') as HTMLButtonElement;

    let prestigeEvent: unknown = null;
    bus.subscribe('prestige_triggered', (p) => { prestigeEvent = p; });

    // Button is disabled — neither a click nor a full hold fires
    btn.click();
    vi.useFakeTimers();
    try {
      holdFor(btn, 5000);
    } finally {
      vi.useRealTimers();
    }

    expect(prestigeEvent).toBeNull();
  });

  it('sets data-tooltip on the panel explaining prestige mechanic', () => {
    const el = panel.getElement();
    const tooltip = el.getAttribute('data-tooltip');
    expect(tooltip).toContain('Reset');
    expect(tooltip).toContain('Legacy');
  });
});

describe('PrestigePanel LP preview matches PrestigeSystem scoring (#188)', () => {
  const prestigeReadyBuildings = {
    barracks: { level: 5, count: 0 },
    walls: { level: 5 },
    warehouse: { level: 5 },
    silk_weaving: { level: 0 },
    chitin_armory: { level: 0 },
    venom_lab: { level: 0 },
  };

  for (const phase of PHASE_ORDER) {
    it(`preview equals calculateLegacyPoints(food, getPhaseScore('${phase}'))`, () => {
      const totalFoodProduced = 1_000_000_000;
      let state: GameState = {
        ...createInitialState(),
        phase,
        buildings: prestigeReadyBuildings,
        prestige: {
          ...createInitialState().prestige,
          totalFoodProduced,
          totalWoodProduced: 50_000,
          totalStoneProduced: 50_000,
          totalNectarProduced: 25_000,
        },
      };
      const panel = new PrestigePanel(new EventBus(), () => state, testActions(new EventBus(), () => state, (s) => { state = s; }), confirmSettings());
      panel.refresh();
      const value = panel.getElement().querySelector('.stat-row.projected .stat-value')?.textContent;
      const expected = calculateLegacyPoints(totalFoodProduced, getPhaseScore(phase));
      expect(value).toBe(`+${expected} LP`);
    });
  }
});

describe('PrestigePanel render stability (#186)', () => {
  let panel: PrestigePanel;
  let currentState: GameState;

  beforeEach(() => {
    currentState = createInitialState();
    panel = new PrestigePanel(new EventBus(), () => currentState, testActions(new EventBus(), () => currentState, (s: GameState) => { currentState = s; }), confirmSettings());
  });

  it('keeps the same button nodes when a tick changes nothing the panel shows (#186)', () => {
    const btnBefore = panel.getElement().querySelector('.btn-prestige');
    expect(btnBefore).not.toBeNull();
    // A tick that only changes food: the effect re-runs, but nothing displayed changed.
    gameState.value = {
      ...gameState.value,
      resources: { ...gameState.value.resources, food: gameState.value.resources.food + 1 },
    };
    expect(panel.getElement().querySelector('.btn-prestige')).toBe(btnBefore);
  });

  it('re-renders when a displayed value changes', () => {
    const btnBefore = panel.getElement().querySelector('.btn-prestige');
    currentState = { ...currentState, prestige: { ...currentState.prestige, legacyPoints: currentState.prestige.legacyPoints + 1 } };
    const statBefore = panel.getElement().querySelector('.stat-row');
    panel.refresh();
    expect(panel.getElement().querySelector('.stat-row')).not.toBe(statBefore);
    expect(panel.getElement().textContent).toContain(String(currentState.prestige.legacyPoints));
    // The confirm control is its own Preact root: a re-render never replaces it (or drops a hold).
    expect(panel.getElement().querySelector('.btn-prestige')).toBe(btnBefore);
  });
});

describe('PrestigePanel: prestige needs a deliberate confirm (Story 1.13)', () => {
  const readyBuildings = {
    barracks: { level: 5, count: 0 },
    walls: { level: 5 },
    warehouse: { level: 5 },
    silk_weaving: { level: 0 },
    chitin_armory: { level: 0 },
    venom_lab: { level: 0 },
  };
  let bus: EventBus;
  let currentState: GameState;
  let fired: number;

  function makePanel(settings = confirmSettings()) {
    currentState = {
      ...createInitialState(),
      buildings: readyBuildings,
      prestige: { count: 0, legacyPoints: 0, totalFoodProduced: 100_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
    };
    bus = new EventBus();
    fired = 0;
    bus.subscribe('prestige_triggered', () => { fired++; });
    const panel = new PrestigePanel(bus, () => currentState, testActions(bus, () => currentState, (s: GameState) => { currentState = s; }), settings);
    panel.refresh();
    return panel.getElement().querySelector('.btn-prestige') as HTMLButtonElement;
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a plain click does not prestige', () => {
    const btn = makePanel();
    btn.click();
    vi.advanceTimersByTime(5000);
    expect(fired).toBe(0);
    expect(currentState.prestige.count).toBe(0);
  });

  it('a hold shorter than the setting does not prestige; a full hold does, once', () => {
    const settings = confirmSettings({ confirmHoldMs: 2000 });
    const btn = makePanel(settings);
    holdFor(btn, settings.value.confirmHoldMs - 1);
    vi.advanceTimersByTime(5000);
    expect(fired).toBe(0);
    holdFor(btn, settings.value.confirmHoldMs, 2);
    expect(fired).toBe(1);
    expect(currentState.prestige.count).toBeGreaterThan(0);
  });

  it('two-tap mode: the first tap arms, the second prestiges', () => {
    const btn = makePanel(confirmSettings({ confirmStyle: 'twoTaps' }));
    btn.click();
    expect(fired).toBe(0);
    btn.click();
    expect(fired).toBe(1);
  });
});
