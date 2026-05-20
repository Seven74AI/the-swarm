import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';
import { AutoProductionPanel } from '../../src/ui/panels/AutoProductionPanel';
import { RESEARCHES } from '../../src/systems/AutomationSystem';

/**
 * AutoProductionPanel tests — UI behavior.
 *
 * Covers:
 * - Panel renders with correct structure
 * - Research tree shows cost/status for each research
 * - Research button states (can research, too expensive, already researched)
 * - Building controls render with level and cost
 * - Effect reactivity on state changes
 * - Enabled toggle
 */
describe('AutoProductionPanel', () => {
  let bus: EventBus;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    state = createInitialState();
  });

  it('creates panel with automation-panel class', () => {
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; });
    const el = panel.getElement();
    expect(el).toBeInstanceOf(HTMLDivElement);
    expect(el.className).toContain('automation-panel');
  });

  it('shows the enabled toggle', () => {
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; });
    const el = panel.getElement();
    const toggleLabel = el.querySelector('.auto-toggle-label');
    expect(toggleLabel).toBeTruthy();
  });

  it('shows current auto egg rate', () => {
    state.autoProduction.enabled = true;
    state.autoProduction.researches['basic_incubation'] = true;
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; });
    const el = panel.getElement();
    const rateEl = el.querySelector('.auto-rate');
    expect(rateEl).toBeTruthy();
    expect(rateEl!.textContent).toContain('0.5');
  });

  it('renders research rows for all researches', () => {
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; });
    const el = panel.getElement();
    const researchRows = el.querySelectorAll('.research-row');
    expect(researchRows.length).toBe(Object.keys(RESEARCHES).length);
  });

  it('research button is disabled when cost not affordable', () => {
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; });
    const el = panel.getElement();
    // Basic incubation costs 100 food, 50 workers — not affordable
    const basicRow = el.querySelector('[data-research="basic_incubation"]');
    const btn = basicRow?.querySelector('button');
    expect(btn?.disabled).toBe(true);
  });

  it('research button is enabled when cost affordable', () => {
    state.resources.food = 100;
    state.resources.workers = 50;
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; });
    const el = panel.getElement();
    const basicRow = el.querySelector('[data-research="basic_incubation"]');
    const btn = basicRow?.querySelector('button');
    expect(btn?.disabled).toBe(false);
  });

  it('research click unlocks research and updates state', () => {
    state.resources.food = 100;
    state.resources.workers = 50;
    let captured: GameState | null = null;
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; captured = s; });
    const el = panel.getElement();
    const basicRow = el.querySelector('[data-research="basic_incubation"]');
    const btn = basicRow?.querySelector('button') as HTMLButtonElement;
    btn.click();

    expect(captured).toBeTruthy();
    expect(captured!.autoProduction.researches['basic_incubation']).toBe(true);
    expect(captured!.resources.food).toBe(0); // 100 - 100
    expect(captured!.resources.workers).toBe(0); // 50 - 50
  });

  it('shows building rows', () => {
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; });
    const el = panel.getElement();
    const buildingRows = el.querySelectorAll('.auto-building-row');
    expect(buildingRows.length).toBe(3); // Nursery, Hatchery, Queen's Chamber
  });

  it('toggle enables/disables auto production', () => {
    let captured: GameState | null = null;
    const panel = new AutoProductionPanel(bus, () => state, (s) => { state = s; captured = s; });
    const el = panel.getElement();
    const toggle = el.querySelector('.auto-toggle') as HTMLInputElement;
    expect(toggle).toBeTruthy();

    // Toggle on
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(captured!.autoProduction.enabled).toBe(true);

    // Toggle off
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(captured!.autoProduction.enabled).toBe(false);
  });
});
