import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState } from '../../../../src/state/GameState';
import { EventBus } from '../../../../src/engine/EventBus';
import { createPanelReveal, PanelRevealContext } from '../../../../src/ui/shell/panelReveal';
import { MapSegment, StarsSegment } from '../../../../src/ui/front/FrontSegments';
import { testActions } from '../../helpers/actions';

/**
 * Story 1.36: FRONT → MAP and STARS mount the remaining legacy Phase 4–5
 * panels directly (UIRoot is gone), until Epic 6 rebuilds them. Each panel
 * appears once its phase reveals it, keeps its id, and is created once.
 */
afterEach(() => cleanup());
beforeEach(() => {
  gameState.value = createInitialState();
});

function setup() {
  const bus = new EventBus();
  const panels = createPanelReveal();
  const deps = { bus, getState: () => gameState.value, actions: testActions(bus) };
  const view = render(
    <PanelRevealContext.Provider value={panels}>
      <div data-seg="map">
        <MapSegment {...deps} />
      </div>
      <div data-seg="stars">
        <StarsSegment {...deps} />
      </div>
    </PanelRevealContext.Provider>,
  );
  const ids = (seg: string) =>
    [...view.container.querySelectorAll(`[data-seg="${seg}"] [data-panel]`)].map((el) => el.getAttribute('data-panel'));
  return { bus, panels, view, ids };
}

describe('FRONT segments', () => {
  it('mount nothing before their phase reveals the panels', () => {
    const { view } = setup();
    expect(view.container.querySelector('[data-panel]')).toBeNull();
  });

  it('MAP mounts the map and the expeditions, in that order, with their ids kept', () => {
    const { panels, view, ids } = setup();
    act(() => panels.reveal(['map_panel', 'expedition_panel']));
    expect(ids('map')).toEqual(['map_panel', 'expedition_panel']);
    expect(view.container.querySelector('[data-seg="map"] .map-panel')).not.toBeNull();
    expect(view.container.querySelector('[data-seg="map"] #expedition-panel')?.classList.contains('panel-revealed')).toBe(true);
  });

  it('STARS mounts ships, explorations, discoveries and the star map, in that order', () => {
    const { panels, view, ids } = setup();
    act(() => panels.reveal(['spaceship_panel', 'exploration_panel', 'cosmic_panel', 'starmap_panel']));
    expect(ids('stars')).toEqual(['spaceship_panel', 'exploration_panel', 'cosmic_panel', 'starmap_panel']);
    for (const id of ['#spaceship-panel', '#exploration-panel', '#cosmic-panel', '#starmap-panel']) {
      expect(view.container.querySelector(`[data-seg="stars"] ${id}`), id).not.toBeNull();
    }
  });

  it('creates each legacy panel once, however often it is revealed', () => {
    const { panels, view } = setup();
    act(() => panels.reveal(['spaceship_panel']));
    const ship = view.container.querySelector('#spaceship-panel');
    act(() => panels.reveal(['spaceship_panel', 'starmap_panel']));
    expect(view.container.querySelectorAll('#spaceship-panel')).toHaveLength(1);
    expect(view.container.querySelector('#spaceship-panel')).toBe(ship);
  });

  it('a tapped planet card is announced as planet_clicked (the event log writes it)', () => {
    const { bus, panels, view } = setup();
    const seen: unknown[] = [];
    bus.subscribe('planet_clicked', (p) => void seen.push(p));
    act(() => panels.reveal(['starmap_panel']));
    const card = view.container.querySelector<HTMLElement>('#starmap-panel .expedition-card');
    expect(card).not.toBeNull();
    card!.click();
    expect(seen.length).toBe(1);
  });
});
