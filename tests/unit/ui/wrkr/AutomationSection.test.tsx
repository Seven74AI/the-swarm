import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState } from '../../../../src/state/GameState';
import { AUTOMATION_BUILDINGS, RESEARCHES, getAutoEggRate, getResearchCost, getAutoBuildCost } from '../../../../src/systems/AutomationSystem';
import { AutomationSection } from '../../../../src/ui/wrkr/AutomationSection';
import { formatRate } from '../../../../src/utils/format';
import { testActions } from '../../helpers/actions';

/**
 * Story 1.23: the automation section of WRKR replaces AutoProductionPanel.
 * It keeps the panel's hooks (`#automation-panel`, `.auto-toggle`,
 * `.auto-rate`, `.research-row[data-research]`, `.auto-building-row[data-building]`).
 */

const mount = () => render(<AutomationSection actions={testActions()} />).container;
const press = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
};
const researchBtn = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-research="${id}"] button`)!;

/** Enough stock for one research's cost. */
function affordResearch(id: keyof typeof RESEARCHES): void {
  const s = gameState.value;
  const cost = getResearchCost(id);
  const resources = { ...s.resources };
  for (const [k, v] of Object.entries(cost)) resources[k as keyof typeof resources] += v ?? 0;
  gameState.value = { ...s, resources };
}

describe('AutomationSection (Story 1.23)', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });
  afterEach(() => cleanup());

  it('keeps the #automation-panel hooks and the toggle', () => {
    const c = mount();
    const panel = c.querySelector('#automation-panel')!;
    expect(panel.classList.contains('automation-panel')).toBe(true);
    expect(panel.querySelector('.auto-toggle-label .auto-toggle')).not.toBeNull();
  });

  it('turns auto-production on and off through the toggle', async () => {
    const c = mount();
    const toggle = c.querySelector<HTMLInputElement>('.auto-toggle')!;
    await act(() => {
      fireEvent.click(toggle);
    });
    expect(gameState.value.autoProduction.enabled).toBe(true);
    expect(toggle.checked).toBe(true);
    await act(() => {
      fireEvent.click(toggle);
    });
    expect(gameState.value.autoProduction.enabled).toBe(false);
  });

  it('shows the current auto egg rate', () => {
    const s = createInitialState();
    gameState.value = { ...s, autoProduction: { ...s.autoProduction, enabled: true, researches: { basic_incubation: true } } };
    const c = mount();
    expect(c.querySelector('.auto-rate')!.textContent).toContain(formatRate(getAutoEggRate(gameState.value)));
  });

  it('has one research row per research and one building row per automation building', () => {
    const c = mount();
    expect(c.querySelectorAll('.research-row')).toHaveLength(Object.keys(RESEARCHES).length);
    expect(c.querySelectorAll('.auto-building-row')).toHaveLength(Object.keys(AUTOMATION_BUILDINGS).length);
  });

  it('disables a research it cannot afford, and one whose prerequisite is missing', () => {
    affordResearch('thermal_regulation');
    const c = mount();
    expect(researchBtn(c, 'basic_incubation').getAttribute('aria-disabled')).toBe('true');
    expect(researchBtn(c, 'thermal_regulation').getAttribute('aria-disabled')).toBe('true');
    expect(c.querySelector('[data-research="thermal_regulation"]')!.textContent).toContain(
      RESEARCHES.queens_pheromones.name.toUpperCase(),
    );
  });

  it('researches an affordable research: it is spent and marked researched', async () => {
    affordResearch('basic_incubation');
    const c = mount();
    const before = gameState.value.resources.food;
    expect(researchBtn(c, 'basic_incubation').getAttribute('aria-disabled')).toBeNull();
    await act(() => press(researchBtn(c, 'basic_incubation')));
    expect(gameState.value.autoProduction.researches.basic_incubation).toBe(true);
    expect(gameState.value.resources.food).toBeLessThan(before);
    expect(c.querySelector('[data-research="basic_incubation"]')!.classList.contains('researched')).toBe(true);
  });

  it('disables a gated building until its research is done, naming the research (#193)', () => {
    const s = createInitialState();
    const cost = getAutoBuildCost('nursery', 1);
    const resources = { ...s.resources };
    for (const [k, v] of Object.entries(cost)) resources[k as keyof typeof resources] += v ?? 0;
    gameState.value = { ...s, resources };
    const c = mount();
    const row = c.querySelector('[data-building="nursery"]')!;
    expect(row.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');
    expect(row.textContent).toContain(`needs ${RESEARCHES.thermal_regulation.name.toUpperCase()}`);
  });

  it('builds an affordable automation building one level', async () => {
    const s = createInitialState();
    const cost = getAutoBuildCost('nursery', 1);
    const resources = { ...s.resources };
    for (const [k, v] of Object.entries(cost)) resources[k as keyof typeof resources] += v ?? 0;
    gameState.value = {
      ...s,
      resources,
      autoProduction: { ...s.autoProduction, researches: { ...s.autoProduction.researches, thermal_regulation: true } },
    };
    const c = mount();
    await act(() => press(c.querySelector('[data-building="nursery"] button')!));
    expect(gameState.value.autoProduction.buildings.nursery).toBe(1);
  });
});
