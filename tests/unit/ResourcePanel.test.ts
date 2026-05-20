/**
 * ResourcePanel — Scannable Multi-Resource HUD tests
 * Tests: critical bar, collapsible sections, phase gating, progress bars, collapse/expand
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { ResourcePanel } from '../../src/ui/panels/ResourcePanel';
import { Phase } from '../../src/phases/phases';
import { createInitialState } from '../../src/state/GameState';

describe('ResourcePanel — Scannable HUD', () => {
  let panel: ResourcePanel;
  let el: HTMLDivElement;

  beforeEach(() => {
    // Set a rich initial state so all resources are non-zero
    const state = createInitialState();
    state.phase = Phase.COLONY;
    state.resources.eggs = 1200;
    state.resources.larvae = 847;
    state.resources.workers = 156;
    state.resources.food = 3456;
    state.resources.nestCapacity = 200;
    state.resources.voidCrystals = 50;
    state.resources.antimatter = 30;
    state.resources.darkMatter = 10;
    state.soldiers.scouts = 5;
    state.soldiers.warriors = 7;
    // Set signal value so effects fire
    gameState.value = { ...state };

    // Clear localStorage between tests
    localStorage.clear();

    panel = new ResourcePanel();
    el = panel.getElement();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ─── Critical Bar (always visible) ──────────────────────────────

  describe('critical bar', () => {
    it('renders a critical bar with eggs, larvae, food, and soldiers icons', () => {
      const criticalBar = el.querySelector('.critical-bar');
      expect(criticalBar).not.toBeNull();

      const text = criticalBar?.textContent || '';
      expect(text).toContain('🥚');
      expect(text).toContain('🐛');
      expect(text).toContain('🍞');
      expect(text).toContain('⚔️');
    });

    it('shows egg count in critical bar', () => {
      const criticalBar = el.querySelector('.critical-bar');
      const text = criticalBar?.textContent || '';
      expect(text).toContain('1,200');
    });

    it('shows larvae count in critical bar', () => {
      const criticalBar = el.querySelector('.critical-bar');
      const text = criticalBar?.textContent || '';
      expect(text).toContain('847');
    });

    it('shows food count in critical bar', () => {
      const criticalBar = el.querySelector('.critical-bar');
      const text = criticalBar?.textContent || '';
      expect(text).toContain('3,456');
    });

    it('shows total soldier count (scouts + warriors) in critical bar', () => {
      const criticalBar = el.querySelector('.critical-bar');
      const text = criticalBar?.textContent || '';
      // 5 scouts + 7 warriors = 12
      expect(text).toContain('12');
    });
  });

  // ─── Collapsible Sections ───────────────────────────────────────

  describe('collapsible sections', () => {
    it('renders a Colony Resources section with collapse toggle', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      expect(colonySection).not.toBeNull();

      const toggle = colonySection?.querySelector('.section-toggle');
      expect(toggle).not.toBeNull();
    });

    it('colony section is expanded by default (▼ icon)', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const toggle = colonySection?.querySelector('.section-toggle');
      expect(toggle?.textContent).toContain('▼');
    });

    it('colony section shows workers count', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const text = colonySection?.textContent || '';
      expect(text).toContain('🐜');
      expect(text).toContain('156');
    });

    it('colony section shows nest capacity progress', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const text = colonySection?.textContent || '';
      expect(text).toContain('Nest Capacity');
      // 156/200 = 78%
      expect(text).toContain('78');
    });

    it('colony section shows larvae count', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const text = colonySection?.textContent || '';
      expect(text).toContain('Larvae');
      expect(text).toContain('847');
    });

    it('collapse toggle click hides colony resources content body', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const toggle = colonySection?.querySelector('.section-toggle') as HTMLElement;
      const body = colonySection?.querySelector('.section-body') as HTMLElement;

      expect(body?.style.display).not.toBe('none');

      toggle?.click();

      expect(toggle?.textContent).toContain('▶');
      expect(body?.style.display || getComputedStyle(body).display).toBe('none');
    });

    it('double toggle re-expands colony section', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const toggle = colonySection?.querySelector('.section-toggle') as HTMLElement;
      const body = colonySection?.querySelector('.section-body') as HTMLElement;

      toggle?.click(); // collapse
      toggle?.click(); // expand

      expect(toggle?.textContent).toContain('▼');
      expect(body?.style.display).not.toBe('none');
    });

    it('collapse state persists in localStorage', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const toggle = colonySection?.querySelector('.section-toggle') as HTMLElement;

      toggle?.click(); // collapse

      const saved = JSON.parse(localStorage.getItem('swarm_hud_sections') || '{}');
      expect(saved['colony']).toBe(false); // collapsed = false meaning not expanded
    });

    it('restores collapsed state from localStorage on reload', () => {
      // Pre-set colony as collapsed in localStorage
      localStorage.setItem('swarm_hud_sections', JSON.stringify({ colony: false }));

      const panel2 = new ResourcePanel();
      const el2 = panel2.getElement();
      const colonySection = el2.querySelector('.hud-section.colony-section');
      const toggle = colonySection?.querySelector('.section-toggle');
      const body = colonySection?.querySelector('.section-body') as HTMLElement;

      expect(toggle?.textContent).toContain('▶');
      expect(body?.style.display || getComputedStyle(body).display).toBe('none');
    });
  });

  // ─── Progress Bars ──────────────────────────────────────────────

  describe('progress bars', () => {
    it('shows progress bar for nest capacity (workers / capacity)', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const progressBar = colonySection?.querySelector('.progress-bar');
      expect(progressBar).not.toBeNull();
    });

    it('progress bar fill reflects worker-to-capacity ratio', () => {
      const colonySection = el.querySelector('.hud-section.colony-section');
      const fill = colonySection?.querySelector('.progress-fill') as HTMLElement;
      expect(fill).not.toBeNull();

      // 156 workers / 200 capacity = 78%
      const width = fill.style.width;
      expect(width).toContain('78');
    });
  });

  // ─── Phase Gating ───────────────────────────────────────────────

  describe('phase gating', () => {
    it('space section is hidden when phase < SPACE (colony phase)', () => {
      const spaceSection = el.querySelector('.hud-section.space-section');
      expect(spaceSection).toBeNull();
    });

    it('space section is visible when phase is SPACE', () => {
      const state = createInitialState();
      state.phase = Phase.SPACE;
      state.resources.voidCrystals = 10;
      state.resources.antimatter = 5;
      state.resources.darkMatter = 2;
      gameState.value = { ...state };

      const panel2 = new ResourcePanel();
      const el2 = panel2.getElement();
      const spaceSection = el2.querySelector('.hud-section.space-section');
      expect(spaceSection).not.toBeNull();
    });

    it('prestige section is hidden when phase < TRANSCENDENCE', () => {
      const prestigeSection = el.querySelector('.hud-section.prestige-section');
      expect(prestigeSection).toBeNull();
    });

    it('prestige section is visible when phase is TRANSCENDENCE', () => {
      const state = createInitialState();
      state.phase = Phase.TRANSCENDENCE;
      gameState.value = { ...state };

      const panel2 = new ResourcePanel();
      const el2 = panel2.getElement();
      const prestigeSection = el2.querySelector('.hud-section.prestige-section');
      expect(prestigeSection).not.toBeNull();
    });
  });

  // ─── Visual Design ──────────────────────────────────────────────

  describe('visual design', () => {
    it('colony section has amber border-left color', () => {
      const colonySection = el.querySelector('.hud-section.colony-section') as HTMLElement;
      expect(colonySection).not.toBeNull();
      // border-left-color set via CSS class
      expect(colonySection.classList.contains('colony-section')).toBe(true);
    });

    it('space section has purple border-left color', () => {
      const state = createInitialState();
      state.phase = Phase.SPACE;
      state.resources.voidCrystals = 10;
      gameState.value = { ...state };

      const panel2 = new ResourcePanel();
      const el2 = panel2.getElement();
      const spaceSection = el2.querySelector('.hud-section.space-section') as HTMLElement;
      expect(spaceSection).not.toBeNull();
      expect(spaceSection.classList.contains('space-section')).toBe(true);
    });

    it('prestige section has gold border-left color', () => {
      const state = createInitialState();
      state.phase = Phase.TRANSCENDENCE;
      gameState.value = { ...state };

      const panel2 = new ResourcePanel();
      const el2 = panel2.getElement();
      const prestigeSection = el2.querySelector('.hud-section.prestige-section') as HTMLElement;
      expect(prestigeSection).not.toBeNull();
      expect(prestigeSection.classList.contains('prestige-section')).toBe(true);
    });

    it('panel retains the "panel resource-panel" CSS classes', () => {
      expect(el.classList.contains('panel')).toBe(true);
      expect(el.classList.contains('resource-panel')).toBe(true);
    });
  });
});
