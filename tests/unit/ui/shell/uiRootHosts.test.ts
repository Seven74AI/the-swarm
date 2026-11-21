import { describe, it, expect, afterEach } from 'vitest';
import { testActions } from '../../helpers/actions';
import { confirmSettings } from '../../helpers/confirm';
import { shellHosts } from '../../helpers/shellHosts';
import { EventBus } from '../../../../src/engine/EventBus';
import { UIRoot } from '../../../../src/ui/UIRoot';
import { SaveManager } from '../../../../src/persistence/SaveManager';
import { createInitialState, type GameState } from '../../../../src/state/GameState';
import { Ticker } from '../../../../src/engine/Ticker';
import { GameLoop } from '../../../../src/engine/GameLoop';
import { PANEL_PLACEMENT, type PanelId } from '../../../../src/data/content/tabs';

/** Story 1.15: UIRoot mounts every legacy panel into the host of its tab, keeping its id hooks. */
describe('UIRoot in the tab shell', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('puts each panel in its tab, segment, zone or the strip', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let state = createInitialState();
    const bus = new EventBus();
    const ui = new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager: new SaveManager(),
      getState: () => state,
      loop: new GameLoop(new Ticker()),
      confirmSettings: confirmSettings(),
    });
    const hosts = shellHosts(container);
    ui.mount(hosts);
    for (const id of Object.keys(PANEL_PLACEMENT) as PanelId[]) {
      const el = ui.createPanel(id);
      expect(hosts.host(PANEL_PLACEMENT[id]).contains(el), id).toBe(true);
    }
    expect(container.querySelector('[data-tab-panel="wrkr"] #worker-assignment')).not.toBeNull();
    expect(container.querySelector('[data-segment-panel="stars"] #spaceship-panel')).not.toBeNull();
    expect(container.querySelector('[data-primary-for="nest"] #click-egg')).not.toBeNull();
    expect(container.querySelector('[data-shell-strip] #top-bar')).not.toBeNull();
  });

  it('mounts the phase line into #phase-indicator on NEST (Story 1.18)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let state = createInitialState();
    const bus = new EventBus();
    const mounted: HTMLElement[] = [];
    const ui = new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager: new SaveManager(),
      getState: () => state,
      loop: new GameLoop(new Ticker()),
      confirmSettings: confirmSettings(),
      mountPhaseLine: (host) => { mounted.push(host); },
    });
    ui.mount(shellHosts(container));
    const host = container.querySelector<HTMLElement>('[data-tab-panel="nest"] #phase-indicator');
    expect(host).not.toBeNull();
    expect(host!.classList.contains('phase-indicator')).toBe(true);
    expect(mounted).toContain(host);
  });
});

