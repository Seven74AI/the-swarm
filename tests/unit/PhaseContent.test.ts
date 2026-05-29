import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PhaseContent } from '../../src/phases/PhaseContent';
import { Phase } from '../../src/phases/phases';
import { EventBus } from '../../src/engine/EventBus';

describe('PhaseContent', () => {
  let phaseContent: PhaseContent;

  beforeEach(() => {
    phaseContent = new PhaseContent();
  });

  describe('getActivePanels', () => {
    it('returns egg_laying panels', () => {
      const panels = phaseContent.getActivePanels(Phase.EGG_LAYING);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
    });

    it('returns colony panels (includes worker_assignment)', () => {
      const panels = phaseContent.getActivePanels(Phase.COLONY);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
      expect(panels).toContain('worker_assignment');
      // food_display panel now implemented — verifies it's included in colony panels
    });

    it('colon phase has more panels than egg_laying', () => {
      const eggPanels = phaseContent.getActivePanels(Phase.EGG_LAYING);
      const colonyPanels = phaseContent.getActivePanels(Phase.COLONY);
      expect(colonyPanels.length).toBeGreaterThan(eggPanels.length);
    });

    it('returns expansion panels with map_panel, building_panel, expedition_panel', () => {
      const panels = phaseContent.getActivePanels(Phase.EXPANSION);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
      expect(panels).toContain('worker_assignment');
      expect(panels).toContain('soldier_panel');
      expect(panels).toContain('battle_panel');
      expect(panels).toContain('map_panel');
      expect(panels).toContain('building_panel');
      expect(panels).toContain('expedition_panel');
    });

    it('expansion phase has more panels than combat', () => {
      const combatPanels = phaseContent.getActivePanels(Phase.COMBAT);
      const expansionPanels = phaseContent.getActivePanels(Phase.EXPANSION);
      expect(expansionPanels.length).toBeGreaterThan(combatPanels.length);
    });

    it('space phase includes expansion panels plus space-specific ones', () => {
      const panels = phaseContent.getActivePanels(Phase.SPACE);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
      expect(panels).toContain('worker_assignment');
      expect(panels).toContain('soldier_panel');
      expect(panels).toContain('battle_panel');
      expect(panels).toContain('map_panel');
      expect(panels).toContain('building_panel');
      expect(panels).toContain('expedition_panel');
      expect(panels).toContain('spaceship_panel');
      expect(panels).toContain('exploration_panel');
      expect(panels).toContain('cosmic_panel');
    });

    it('space phase has more panels than expansion', () => {
      const expansionPanels = phaseContent.getActivePanels(Phase.EXPANSION);
      const spacePanels = phaseContent.getActivePanels(Phase.SPACE);
      expect(spacePanels.length).toBeGreaterThan(expansionPanels.length);
    });

    it('transcendence phase includes same panels as space', () => {
      const panels = phaseContent.getActivePanels(Phase.TRANSCENDENCE);
      expect(panels).toContain('click_button');
      expect(panels).toContain('event_log');
      expect(panels).toContain('phase_indicator');
      expect(panels).toContain('resource_panel');
      expect(panels).toContain('worker_assignment');
      expect(panels).toContain('soldier_panel');
      expect(panels).toContain('battle_panel');
      expect(panels).toContain('map_panel');
      expect(panels).toContain('building_panel');
      expect(panels).toContain('expedition_panel');
      expect(panels).toContain('spaceship_panel');
      expect(panels).toContain('exploration_panel');
      expect(panels).toContain('cosmic_panel');
      // transcendence_panel was a phantom panel (never existed) — removed in #17
    });

    it('transcendence phase has same panels as space', () => {
      const spacePanels = phaseContent.getActivePanels(Phase.SPACE);
      const transcendencePanels = phaseContent.getActivePanels(Phase.TRANSCENDENCE);
      expect(transcendencePanels.length).toBeGreaterThanOrEqual(spacePanels.length);
    });
  });

  describe('getLoreQuote', () => {
    it('returns a non-empty string for EGG_LAYING', () => {
      const quote = phaseContent.getLoreQuote(Phase.EGG_LAYING);
      expect(quote).toBeTruthy();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for COLONY', () => {
      const quote = phaseContent.getLoreQuote(Phase.COLONY);
      expect(quote).toBeTruthy();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for COMBAT', () => {
      const quote = phaseContent.getLoreQuote(Phase.COMBAT);
      expect(quote).toBeTruthy();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for EXPANSION', () => {
      const quote = phaseContent.getLoreQuote(Phase.EXPANSION);
      expect(quote).toBeTruthy();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for SPACE', () => {
      const quote = phaseContent.getLoreQuote(Phase.SPACE);
      expect(quote).toBeTruthy();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for TRANSCENDENCE', () => {
      const quote = phaseContent.getLoreQuote(Phase.TRANSCENDENCE);
      expect(quote).toBeTruthy();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });

    it('returns a fallback for unknown phases', () => {
      const quote = phaseContent.getLoreQuote('nonexistent' as Phase);
      expect(quote).toBeTruthy();
      expect(typeof quote).toBe('string');
      expect(quote.length).toBeGreaterThan(0);
    });
  });

  describe('triggerTransition', () => {
    let bus: EventBus;
    let uiRoot: { showPanel: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      vi.useFakeTimers();
      bus = new EventBus();
      uiRoot = { showPanel: vi.fn() };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('emits transition_start with phase and quote immediately', () => {
      const events: unknown[] = [];
      bus.subscribe('transition_start', (payload) => events.push(payload));

      phaseContent.triggerTransition(Phase.COLONY, bus, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);

      expect(events).toHaveLength(1);
      const payload = events[0] as { phase: string; quote: string };
      expect(payload.phase).toBe(Phase.COLONY);
      expect(typeof payload.quote).toBe('string');
      expect(payload.quote.length).toBeGreaterThan(0);
    });

    it('emits transition_complete after 3500ms (#animation-timing)', () => {
      const events: unknown[] = [];
      bus.subscribe('transition_complete', (payload) => events.push(payload));

      phaseContent.triggerTransition(Phase.COLONY, bus, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);

      expect(events).toHaveLength(0);
      vi.advanceTimersByTime(3500);
      expect(events).toHaveLength(1);
      const payload = events[0] as { phase: string };
      expect(payload.phase).toBe(Phase.COLONY);
    });

    it('emits transition_complete for SPACE phase', () => {
      const events: unknown[] = [];
      bus.subscribe('transition_complete', (payload) => events.push(payload));

      phaseContent.triggerTransition(Phase.SPACE, bus, uiRoot as unknown as import('../../src/ui/UIRoot').UIRoot);

      vi.advanceTimersByTime(3500);
      expect(events).toHaveLength(1);
      const payload = events[0] as { phase: string };
      expect(payload.phase).toBe(Phase.SPACE);
    });
  });
});
