/**
 * PhaseContent theme/body-class tests — UX-10 Phase Theme Shifting.
 * Tests that onPhaseEnter sets the correct body class for each phase,
 * and that the phase transition integration works.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PhaseContent } from '../../src/phases/PhaseContent';
import { Phase } from '../../src/phases/phases';
import { EventBus } from '../../src/engine/EventBus';

describe('PhaseContent — Phase Theme Shifting', () => {
  let phaseContent: PhaseContent;
  let bus: EventBus;
  let uiRoot: { showPanel: ReturnType<typeof vi.fn>; createPanel: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    phaseContent = new PhaseContent();
    bus = new EventBus();
    uiRoot = { showPanel: vi.fn(), createPanel: vi.fn() };
    // Add a minimal CSS to support body class assertion
    const style = document.createElement('style');
    style.id = 'test-phase-styles';
    style.textContent = `
      body.phase-egg { --bg-primary: #1a1614; }
      body.phase-colony { --bg-primary: #1e1a16; }
      body.phase-combat { --bg-primary: #1e1616; }
      body.phase-expansion { --bg-primary: #161e16; }
      body.phase-space { --bg-primary: #0d1117; }
      body.phase-transcendence { --bg-primary: #0a0a0f; }
      body.phase-colony { --accent-glow: #d4a030; }
      body.phase-combat { --accent-glow: #c04040; }
      body.phase-expansion { --accent-glow: #40a040; }
      body.phase-space { --accent-glow: #7b61ff; }
      body.phase-transcendence { --accent-glow: #ffffff; }
    `;
    document.head.appendChild(style);
  });

  afterEach(() => {
    document.body.className = '';
    const style = document.getElementById('test-phase-styles');
    if (style) style.remove();
  });

  describe('body class toggling per phase', () => {
    it('sets body class to phase-egg when entering EGG_LAYING', () => {
      phaseContent.onPhaseEnter(Phase.EGG_LAYING, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);
      expect(document.body.classList.contains('phase-egg')).toBe(true);
      // Should not have other phase classes
      expect(document.body.classList.contains('phase-colony')).toBe(false);
    });

    it('sets body class to phase-colony when entering COLONY', () => {
      phaseContent.onPhaseEnter(Phase.COLONY, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);
      expect(document.body.classList.contains('phase-colony')).toBe(true);
      // Previous phase class should be cleaned up
      expect(document.body.classList.contains('phase-egg')).toBe(false);
    });

    it('sets body class to phase-combat when entering COMBAT', () => {
      phaseContent.onPhaseEnter(Phase.COMBAT, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);
      expect(document.body.classList.contains('phase-combat')).toBe(true);
    });

    it('sets body class to phase-expansion when entering EXPANSION', () => {
      phaseContent.onPhaseEnter(Phase.EXPANSION, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);
      expect(document.body.classList.contains('phase-expansion')).toBe(true);
    });

    it('sets body class to phase-space when entering SPACE', () => {
      phaseContent.onPhaseEnter(Phase.SPACE, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);
      expect(document.body.classList.contains('phase-space')).toBe(true);
    });

    it('sets body class to phase-transcendence when entering TRANSCENDENCE', () => {
      phaseContent.onPhaseEnter(Phase.TRANSCENDENCE, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);
      expect(document.body.classList.contains('phase-transcendence')).toBe(true);
    });

    it('only one phase body class is active at a time', () => {
      // Enter colony, then combat
      phaseContent.onPhaseEnter(Phase.COLONY, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);
      phaseContent.onPhaseEnter(Phase.COMBAT, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);

      const phaseClasses = Array.from(document.body.classList).filter(
        (c) => c.startsWith('phase-'),
      );
      expect(phaseClasses).toHaveLength(1);
      expect(phaseClasses[0]).toBe('phase-combat');
    });
  });

  describe('triggerTransition sets body class', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets phase body class during transition (onPhaseEnter is called)', () => {
      phaseContent.triggerTransition(Phase.COLONY, bus, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);

      // Advance past the 300ms reveal delay
      vi.advanceTimersByTime(300);

      // Body class should be set by onPhaseEnter
      expect(document.body.classList.contains('phase-colony')).toBe(true);
    });
  });

  describe('getPhaseBodyClass static method', () => {
    it('returns phase-egg for EGG_LAYING', () => {
      expect(PhaseContent.getPhaseBodyClass(Phase.EGG_LAYING)).toBe('phase-egg');
    });

    it('returns phase-colony for COLONY', () => {
      expect(PhaseContent.getPhaseBodyClass(Phase.COLONY)).toBe('phase-colony');
    });

    it('returns phase-space for SPACE', () => {
      expect(PhaseContent.getPhaseBodyClass(Phase.SPACE)).toBe('phase-space');
    });

    it('returns phase-transcendence for TRANSCENDENCE', () => {
      expect(PhaseContent.getPhaseBodyClass(Phase.TRANSCENDENCE)).toBe('phase-transcendence');
    });

    it('returns undefined for unknown phase', () => {
      expect(PhaseContent.getPhaseBodyClass('unknown' as Phase)).toBeUndefined();
    });
  });
});
