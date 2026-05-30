import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { ResourceConverterPanel } from '../../src/ui/panels/ResourceConverterPanel';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';

describe('ResourceConverterPanel', () => {
  let bus: EventBus;
  let panel: ResourceConverterPanel;
  let currentState: GameState;

  beforeEach(() => {
    bus = new EventBus();
    currentState = createInitialState();
    panel = new ResourceConverterPanel(
      bus,
      () => currentState,
      (s: GameState) => { currentState = s; },
    );
  });

  it('creates a panel element with correct className', () => {
    const el = panel.getElement();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('panel');
    expect(el.className).toContain('resource-converter-panel');
  });

  it('shows the Resource Converter title', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Resource Converter');
  });

  it('shows all three conversion step names', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Void Crystal');
    expect(text).toContain('Antimatter');
    expect(text).toContain('Dark Matter');
  });

  it('shows conversion step icons', () => {
    const el = panel.getElement();
    const html = el.innerHTML || '';
    expect(html).toContain('🔮');
    expect(html).toContain('⚛️');
    expect(html).toContain('🕳️');
  });

  it('shows input/output costs for each step', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    // Step 1: stone + nectar → voidCrystals
    expect(text).toContain('stone');
    expect(text).toContain('nectar');
    expect(text).toContain('voidCrystals');
    expect(text).toContain('antimatter');
    expect(text).toContain('darkMatter');
  });

  it('shows locked status when research is not completed', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    // All conversions start locked because no research is completed
    expect(text).toContain('Research required');
  });

  it('shows Particle Lab level in header', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Particle Lab');
  });

  it('shows unlocked status when research is completed', () => {
    // Complete voidCrystalSynthesis research and provide resources
    currentState.research.projects.voidCrystalSynthesis = { state: 'completed', progress: 600 };
    currentState.workersAssigned.researchers = 40;
    currentState.resources.stone = 50;
    currentState.resources.nectar = 20;

    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Active');
  });

  it('convert button becomes enabled when any conversion is unlocked', () => {
    // Locked — button should be disabled
    let el = panel.getElement();
    let btn = el.querySelector('button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);

    // Unlock void crystal synthesis
    currentState.research.projects.voidCrystalSynthesis = { state: 'completed', progress: 600 };
    currentState.workersAssigned.researchers = 40;
    currentState.resources.stone = 50;
    currentState.resources.nectar = 20;

    panel.refresh();
    el = panel.getElement();
    btn = el.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('clicking convert button triggers tickConversions and changes state', () => {
    // Set up for void crystal synthesis
    currentState = {
      ...currentState,
      research: {
        projects: {
          voidCrystalSynthesis: { state: 'completed', progress: 600 },
          antimatterContainment: { state: 'locked', progress: 0 },
          darkMatterDetection: { state: 'locked', progress: 0 },
        },
      },
      workersAssigned: {
        ...currentState.workersAssigned,
        researchers: 40,
      },
      resources: {
        ...currentState.resources,
        stone: 100,
        nectar: 100,
        voidCrystals: 0,
      },
    };

    panel.refresh();
    const beforeVC = currentState.resources.voidCrystals;
    const beforeStone = currentState.resources.stone;

    // Click the button
    const el = panel.getElement();
    const btn = el.querySelector('button') as HTMLButtonElement;
    btn.click();

    // Void crystals should increase, stone should decrease
    expect(currentState.resources.voidCrystals).toBeGreaterThan(beforeVC);
    expect(currentState.resources.stone).toBeLessThan(beforeStone);
  });

  it('no conversion occurs when nothing is unlocked', () => {
    const beforeState = { ...currentState, resources: { ...currentState.resources } };

    const el = panel.getElement();
    const btn = el.querySelector('button') as HTMLButtonElement;
    btn.click();

    // State should not change significantly (no conversions to run)
    expect(currentState.resources.voidCrystals).toBe(beforeState.resources.voidCrystals);
    expect(currentState.resources.antimatter).toBe(beforeState.resources.antimatter);
    expect(currentState.resources.darkMatter).toBe(beforeState.resources.darkMatter);
  });

  it('shows antimatter containment as locked without particle lab', () => {
    // Complete research but no particle lab
    currentState.research.projects.antimatterContainment = { state: 'completed', progress: 1500 };
    currentState.conversions.particleLab = 0;

    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Build a Particle Lab');
  });

  it('shows darkMatter detection as locked without space explorations', () => {
    // Complete research but no exploration
    currentState.research.projects.darkMatterDetection = { state: 'completed', progress: 3000 };
    currentState.spaceExplorations = [];

    panel.refresh();
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('Launch a space exploration');
  });

  it('shows DAG order hint', () => {
    const el = panel.getElement();
    const text = el.textContent || '';
    expect(text).toContain('DAG order');
  });
});
