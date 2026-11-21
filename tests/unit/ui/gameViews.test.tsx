import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { gameState } from '../../../src/state/gameSignal';
import { createInitialState } from '../../../src/state/GameState';
import { EventBus } from '../../../src/engine/EventBus';
import { Phase } from '../../../src/phases/phases';
import { App } from '../../../src/ui/App';
import { gameViews } from '../../../src/ui/gameViews';
import { createTabShell } from '../../../src/ui/shell/tabShell';
import { createPanelReveal } from '../../../src/ui/shell/panelReveal';
import { createSheetController } from '../../../src/ui/shell/SheetController';
import { createResourceFeed } from '../../../src/ui/shell/resourceFeed';
import { createWarSession } from '../../../src/ui/war/warSession';
import { createChronicle } from '../../../src/state/chronicle';
import { PANEL_PLACEMENT, panelsForPhase, type PanelId } from '../../../src/data/content/tabs';
import { testActions } from '../helpers/actions';
import { confirmSettings } from '../helpers/confirm';

/**
 * Story 1.36: UIRoot is gone. The game's views (`ui/gameViews.tsx`) put every
 * panel of the tab registry in its tab, segment, primary zone or the strip,
 * keep the legacy ids, and show each one only once its phase reveals it.
 */
afterEach(() => cleanup());
beforeEach(() => {
  gameState.value = createInitialState();
});

function setup() {
  const bus = new EventBus();
  const actions = testActions(bus);
  const shell = createTabShell({ phase: signal(Phase.TRANSCENDENCE), affordable: signal('') });
  const panels = createPanelReveal();
  const views = gameViews({
    bus,
    getState: () => gameState.value,
    actions,
    confirmSettings: confirmSettings(),
    feed: createResourceFeed(),
    sheets: createSheetController(),
    onOpenSettings: () => {},
    onTogglePause: () => {},
    layMode: signal('hold'),
    war: createWarSession({ actions, onBattleDone: () => {} }),
    segment: shell.segment,
    chronicle: createChronicle(),
    jump: { canJump: () => false, jump: () => {} },
  });
  const view = render(<App views={views} shell={shell} panels={panels} />);
  const c = view.container;
  const revealAll = () => act(() => panels.reveal(Object.keys(PANEL_PLACEMENT) as PanelId[]));
  return { c, panels, revealAll };
}

const containerOf = (c: ParentNode, id: PanelId): Element | null => {
  const p = PANEL_PLACEMENT[id];
  if (p.tab === 'strip') return c.querySelector('[data-shell-strip]');
  if (p.zone === 'primary') return c.querySelector(`[data-primary-for="${p.tab}"]`);
  if (p.segment) return c.querySelector(`[data-segment-panel="${p.segment}"]`);
  return c.querySelector(`[data-tab-content="${p.tab}"]`);
};

describe('the game views', () => {
  it('put every registry panel in the container of its placement', () => {
    const { c, revealAll } = setup();
    revealAll();
    for (const id of Object.keys(PANEL_PLACEMENT) as PanelId[]) {
      const el = c.querySelector<HTMLElement>(`[data-panel="${id}"]`);
      expect(el, id).not.toBeNull();
      expect(containerOf(c, id)?.contains(el ?? null), id).toBe(true);
    }
  });

  it('show only the strip and NEST before Egg Laying reveals its panels, and only that phase\'s panels after', () => {
    const { c, panels } = setup();
    expect(c.querySelector('[data-shell-strip] #top-bar')).not.toBeNull();
    expect(c.querySelector('[data-panel]')).toBeNull();
    act(() => panels.reveal(panelsForPhase(Phase.EGG_LAYING)));
    expect(c.querySelector('#phase-indicator')).not.toBeNull();
    expect(c.querySelector('.resource-panel')?.classList.contains('panel-revealed')).toBe(true);
    expect(c.querySelector('#worker-assignment')).toBeNull();
    expect(c.querySelector('#soldier-panel')).toBeNull();
  });

  it('lay NEST out top to bottom: phase line, scene, event lines, Click Power card, Transcendence', () => {
    const { c, revealAll } = setup();
    revealAll();
    const nest = c.querySelector('[data-tab-content="nest"]')!;
    const order = [...nest.children].map((el) => el.getAttribute('data-panel') ?? el.getAttribute('data-nest-host'));
    expect(order).toEqual(['phase_indicator', 'scene', 'event_log', 'click-power', 'transcendence_panel']);
    expect(nest.querySelector('#activity-log')).not.toBeNull();
    expect(c.querySelector('[data-primary-for="nest"] [data-nest-primary]')).not.toBeNull();
  });

  it('lay WRKR, BUILD, WAR and LOG out top to bottom with the legacy ids kept', () => {
    const { c, revealAll } = setup();
    revealAll();
    const ids = (sel: string) => [...c.querySelector(sel)!.children].map((el) => el.id || el.getAttribute('data-build-host') || el.getAttribute('data-log-host') || el.className);
    expect(ids('[data-tab-content="wrkr"]')).toEqual(['worker-assignment', 'food-display', expect.stringContaining('automation-host')]);
    expect(ids('[data-tab-content="build"]')).toEqual(['header', 'click-power', 'building-panel', 'research-panel', 'resource-converter-panel']);
    expect(ids('[data-segment-panel="war"]')).toEqual(['soldier-panel', 'mutation-panel', 'battle-panel', 'combat-log-panel']);
    expect(ids('[data-tab-content="log"]')).toEqual(['chronicle', 'stats', 'settings', 'legacy']);
    const legacy = c.querySelector('[data-log-section="legacy"]')!;
    expect(legacy.querySelector('#prestige-panel')).not.toBeNull();
    expect(legacy.querySelector('#prestige-tree-panel')).not.toBeNull();
    expect(c.querySelector('[data-primary-for="build"] [data-build-primary-host]')).not.toBeNull();
    expect(c.querySelector('[data-primary-for="front"] [data-war-primary-host]')).not.toBeNull();
    expect(c.querySelector('[data-primary-for="wrkr"] [data-wrkr-primary]')).not.toBeNull();
  });

  it('mount the legacy MAP and STARS panels in their FRONT segments', () => {
    const { c, revealAll } = setup();
    revealAll();
    expect(c.querySelector('[data-segment-panel="map"] .map-panel')).not.toBeNull();
    expect(c.querySelector('[data-segment-panel="map"] #expedition-panel')).not.toBeNull();
    expect(c.querySelector('[data-segment-panel="stars"] #spaceship-panel')).not.toBeNull();
    expect(c.querySelector('[data-segment-panel="stars"] #starmap-panel')).not.toBeNull();
  });
});
