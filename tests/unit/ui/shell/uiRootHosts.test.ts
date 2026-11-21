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
    expect(container.querySelector('[data-primary-for="nest"] [data-nest-primary]')).not.toBeNull();
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

  it('lays NEST out top to bottom: phase line, scene, event lines, Click Power card; LAY EGG in the primary zone (Story 1.22)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let state = createInitialState();
    const bus = new EventBus();
    const mounted: Record<string, HTMLElement> = {};
    const ui = new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager: new SaveManager(),
      getState: () => state,
      loop: new GameLoop(new Ticker()),
      confirmSettings: confirmSettings(),
      mountNest: {
        primary: (host) => { mounted.primary = host; },
        scene: (host) => { mounted.scene = host; },
        clickPower: (host) => { mounted.clickPower = host; },
      },
    });
    ui.mount(shellHosts(container));
    const nest = container.querySelector<HTMLElement>('[data-tab-content="nest"]')!;
    const order = Array.from(nest.children).map((el) => el.id || el.getAttribute('data-nest-host'));
    expect(order).toEqual(['phase-indicator', 'scene', 'activity-log', 'click-power']);
    expect(mounted.scene).toBe(nest.querySelector('[data-nest-host="scene"]'));
    expect(mounted.clickPower).toBe(nest.querySelector('[data-nest-host="click-power"]'));
    expect(mounted.primary).toBe(container.querySelector('[data-primary-for="nest"] [data-nest-primary]'));
  });

  it('lays BUILD out top to bottom with the legacy ids kept, and > BUY in its primary zone (Story 1.24)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let state = createInitialState();
    const bus = new EventBus();
    const mounted: Record<string, HTMLElement> = {};
    const ui = new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager: new SaveManager(),
      getState: () => state,
      loop: new GameLoop(new Ticker()),
      confirmSettings: confirmSettings(),
      mountBuild: {
        header: (host) => { mounted.header = host; },
        clickPower: (host) => { mounted.clickPower = host; },
        buildings: (host) => { mounted.buildings = host; },
        research: (host) => { mounted.research = host; },
        converter: (host) => { mounted.converter = host; },
        primary: (host) => { mounted.primary = host; },
      },
    });
    ui.mount(shellHosts(container));
    for (const id of ['build_header', 'build_click_power', 'building_panel', 'research_panel', 'resource_converter_panel', 'build_primary']) {
      ui.createPanel(id);
    }
    const build = container.querySelector<HTMLElement>('[data-tab-content="build"]')!;
    const order = Array.from(build.children).map((el) => el.id || el.getAttribute('data-build-host'));
    expect(order).toEqual(['header', 'click-power', 'building-panel', 'research-panel', 'resource-converter-panel']);
    expect(mounted.header).toBe(build.querySelector('[data-build-host="header"]'));
    expect(mounted.clickPower).toBe(build.querySelector('[data-build-host="click-power"]'));
    expect(mounted.buildings).toBe(build.querySelector('#building-panel'));
    expect(mounted.research).toBe(build.querySelector('#research-panel'));
    expect(mounted.converter).toBe(build.querySelector('#resource-converter-panel'));
    expect(mounted.primary).toBe(container.querySelector('[data-primary-for="build"] [data-build-primary-host]'));
    expect(build.querySelector('#tech-tree-panel')).toBeNull();
  });

  it('renders WAR into its hosts, keeping #soldier-panel and #battle-panel, FIGHT in FRONT\'s primary zone (Story 1.25)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let state = createInitialState();
    const bus = new EventBus();
    const mounted: Record<string, HTMLElement> = {};
    const ui = new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager: new SaveManager(),
      getState: () => state,
      loop: new GameLoop(new Ticker()),
      confirmSettings: confirmSettings(),
      mountWar: {
        soldiers: (host) => { mounted.soldiers = host; },
        mutations: (host) => { mounted.mutations = host; },
        enemy: (host) => { mounted.enemy = host; },
        log: (host) => { mounted.log = host; },
        primary: (host) => { mounted.primary = host; },
      },
    });
    ui.mount(shellHosts(container));
    for (const id of ['soldier_panel', 'mutation_panel', 'battle_panel', 'combat_log', 'war_primary']) ui.createPanel(id);
    const war = container.querySelector<HTMLElement>('[data-segment-panel="war"]')!;
    expect(mounted.soldiers).toBe(war.querySelector('#soldier-panel'));
    expect(mounted.mutations).toBe(war.querySelector('#mutation-panel'));
    expect(mounted.enemy).toBe(war.querySelector('#battle-panel'));
    expect(mounted.log).toBe(war.querySelector('#combat-log-panel'));
    expect(mounted.primary).toBe(container.querySelector('[data-primary-for="front"] [data-war-primary-host]'));
    const order = Array.from(war.children).map((el) => el.id);
    expect(order).toEqual(['soldier-panel', 'mutation-panel', 'battle-panel', 'combat-log-panel']);
  });

  it('lays LOG out top to bottom: chronicle, lifetime stats, settings, LEGACY holding the prestige panels (Story 1.26)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let state = createInitialState();
    const bus = new EventBus();
    const mounted: Record<string, HTMLElement> = {};
    let legacyPanels: readonly HTMLElement[] = [];
    const ui = new UIRoot({
      bus,
      actions: testActions(bus, () => state, (s: GameState) => { state = s; }),
      saveManager: new SaveManager(),
      getState: () => state,
      loop: new GameLoop(new Ticker()),
      confirmSettings: confirmSettings(),
      mountLog: {
        chronicle: (host) => { mounted.chronicle = host; },
        stats: (host) => { mounted.stats = host; },
        settings: (host) => { mounted.settings = host; },
        legacy: (host, panels) => {
          mounted.legacy = host;
          legacyPanels = panels;
          for (const p of panels) host.appendChild(p);
        },
      },
    });
    ui.mount(shellHosts(container));
    // The prestige panel first: it is still created inside LEGACY.
    const prestige = ui.createPanel('prestige_panel');
    for (const id of ['log_chronicle', 'log_stats', 'log_settings', 'log_legacy', 'prestige_tree_panel']) ui.createPanel(id);
    const log = container.querySelector<HTMLElement>('[data-tab-content="log"]')!;
    const order = Array.from(log.children).map((el) => el.getAttribute('data-log-host'));
    expect(order).toEqual(['chronicle', 'stats', 'settings', 'legacy']);
    expect(mounted.chronicle).toBe(log.querySelector('[data-log-host="chronicle"]'));
    expect(mounted.legacy.contains(prestige)).toBe(true);
    expect(prestige.id).toBe('prestige-panel');
    expect(legacyPanels).toContain(ui.createPanel('prestige_tree_panel'));
    expect(ui.panelElement('prestige_panel')).toBe(prestige);
  });
});
