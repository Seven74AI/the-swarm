import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { Phase } from '../../../../src/phases/phases';
import { createTabShell } from '../../../../src/ui/shell/tabShell';
import { Shell } from '../../../../src/ui/shell/Shell';
import type { ShellHosts } from '../../../../src/ui/shell/hosts';
import { PANEL_PLACEMENT, TABS } from '../../../../src/data/content/tabs';
import { MAX_TABS } from '../../../../src/data/constants';

function setup(phase: Phase = Phase.COLONY) {
  const ph = signal(phase);
  const aff = signal('');
  const shell = createTabShell({ phase: ph, affordable: aff });
  let hosts: ShellHosts | undefined;
  const legacy = { mount: vi.fn((h: ShellHosts) => { hosts = h; }) };
  const view = render(<Shell shell={shell} legacy={legacy} />);
  const bar = () => view.container.querySelector<HTMLElement>('[data-tab-bar]')!;
  const tab = (id: string) => view.container.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`);
  const panel = (id: string) => view.container.querySelector<HTMLElement>(`[data-tab-panel="${id}"]`)!;
  return { ph, aff, shell, legacy, view, bar, tab, panel, hosts: () => hosts! };
}

describe('Shell (Story 1.15)', () => {
  afterEach(() => cleanup());

  it('mounts the legacy UI once, synchronously, with a host for every placement', () => {
    const { legacy, hosts, view } = setup();
    expect(legacy.mount).toHaveBeenCalledTimes(1);
    for (const [id, p] of Object.entries(PANEL_PLACEMENT)) {
      const host = hosts().host(p);
      expect(view.container.contains(host), id).toBe(true);
    }
    expect(hosts().host(PANEL_PLACEMENT.worker_assignment).closest('[data-tab-panel]')?.getAttribute('data-tab-panel')).toBe('wrkr');
    expect(hosts().host(PANEL_PLACEMENT.map_panel).closest('[data-segment-panel]')?.getAttribute('data-segment-panel')).toBe('map');
    expect(hosts().host(PANEL_PLACEMENT.click_button).closest('[data-primary-zone]')).not.toBeNull();
    expect(hosts().strip.matches('[data-shell-strip]')).toBe(true);
  });

  it('Phase 1 shows no tab bar', () => {
    const { bar } = setup(Phase.EGG_LAYING);
    expect(bar().hidden).toBe(true);
  });

  it('Colony shows NEST · WRKR · BUILD · LOG, never more than MAX_TABS', () => {
    const { bar, ph } = setup(Phase.COLONY);
    expect(bar().hidden).toBe(false);
    const labels = () => [...bar().querySelectorAll('[data-tab]')].map((b) => b.getAttribute('data-tab'));
    expect(labels()).toEqual(['nest', 'wrkr', 'build', 'log']);
    act(() => { ph.value = Phase.TRANSCENDENCE; });
    expect(labels().length).toBeLessThanOrEqual(MAX_TABS);
    expect(labels()).toContain('front');
  });

  it('shows only the active tab; the active tab is selected (inverse video)', () => {
    const { tab, panel } = setup();
    expect(panel('nest').hidden).toBe(false);
    expect(panel('wrkr').hidden).toBe(true);
    expect(tab('nest')!.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(tab('wrkr')!);
    expect(panel('wrkr').hidden).toBe(false);
    expect(panel('nest').hidden).toBe(true);
    expect(tab('wrkr')!.getAttribute('aria-selected')).toBe('true');
    expect(tab('nest')!.getAttribute('aria-selected')).toBe('false');
  });

  it('swaps the primary zone with the tab', () => {
    const { tab, view } = setup();
    const zone = (id: string) => view.container.querySelector<HTMLElement>(`[data-primary-for="${id}"]`)!;
    expect(zone('nest').hidden).toBe(false);
    fireEvent.click(tab('build')!);
    expect(zone('nest').hidden).toBe(true);
    expect(zone('build').hidden).toBe(false);
  });

  it('tapping the active tab scrolls it to the top', () => {
    const { tab, view } = setup();
    const scroller = view.container.querySelector<HTMLElement>('[data-shell-scroll]')!;
    scroller.scrollTop = 200;
    fireEvent.click(tab('nest')!);
    expect(scroller.scrollTop).toBe(0);
  });

  it('keeps each tab scroll position for the session', () => {
    const { tab, view, shell } = setup();
    const scroller = view.container.querySelector<HTMLElement>('[data-shell-scroll]')!;
    scroller.scrollTop = 150;
    fireEvent.click(tab('wrkr')!);
    expect(shell.scrollOf('nest')).toBe(150);
  });

  it('shows • on a tab where something became affordable, no numeric badges, cleared on visit', () => {
    const { tab, aff, ph, bar } = setup(Phase.EXPANSION);
    act(() => { aff.value = 'building_panel:warehouse|mutation_panel:a|mutation_panel:b'; });
    expect(tab('build')!.querySelector('[data-tab-dot]')?.textContent).toBe('•');
    expect(tab('front')!.querySelector('[data-tab-dot]')).not.toBeNull();
    // No numeric badges anywhere in the bar.
    expect(bar().textContent).not.toMatch(/\d/);

    fireEvent.click(tab('build')!);
    expect(tab('build')!.querySelector('[data-tab-dot]')).toBeNull();
    void ph;
  });

  it('FRONT has a segment row that opens on the newest segment', () => {
    const { tab, view, ph } = setup(Phase.EXPANSION);
    fireEvent.click(tab('front')!);
    const seg = (id: string) => view.container.querySelector<HTMLElement>(`[data-segment="${id}"]`);
    const segPanel = (id: string) => view.container.querySelector<HTMLElement>(`[data-segment-panel="${id}"]`)!;
    expect(seg('war')).not.toBeNull();
    expect(seg('stars')).toBeNull();
    expect(seg('map')!.getAttribute('aria-selected')).toBe('true');
    expect(segPanel('map').hidden).toBe(false);
    expect(segPanel('war').hidden).toBe(true);

    fireEvent.click(seg('war')!);
    expect(segPanel('war').hidden).toBe(false);
    act(() => { ph.value = Phase.SPACE; });
    expect(segPanel('stars').hidden).toBe(false);
  });

  it('every tab in the registry has a panel container', () => {
    const { panel } = setup();
    for (const t of TABS) expect(panel(t.id)).not.toBeNull();
  });

  it('shows the condensed goal meter under the strip on every tab but NEST (Story 1.18)', () => {
    const { tab, view } = setup(Phase.COLONY);
    const condensed = () => view.container.querySelector<HTMLElement>('[data-goal-meter="condensed"]');
    const line = () => view.container.querySelector<HTMLElement>('[data-goal-line]')!;
    expect(line().hidden).toBe(true);
    act(() => tab('wrkr')!.click());
    expect(line().hidden).toBe(false);
    expect(condensed()).not.toBeNull();
    expect(line().previousElementSibling?.hasAttribute('data-shell-strip')).toBe(true);
    act(() => tab('nest')!.click());
    expect(line().hidden).toBe(true);
  });
});

describe('Shell: CONTINUE (Story 1.19)', () => {
  afterEach(() => cleanup());

  function setupGoal(met: boolean) {
    const goalMet = signal(met);
    const shell = createTabShell({ phase: signal(Phase.COLONY), affordable: signal(''), goalMet });
    const onContinue = vi.fn(() => ({ ok: true as const }));
    const view = render(<Shell shell={shell} legacy={{ mount: vi.fn() }} onContinue={onContinue} />);
    const cont = () => view.container.querySelector<HTMLButtonElement>('[data-action="continue"]');
    const nestSlot = () => view.container.querySelector<HTMLElement>('[data-primary-for="nest"]')!;
    return { goalMet, shell, onContinue, view, cont, nestSlot };
  }

  it('shows no CONTINUE while the goal is not met', () => {
    const { cont, nestSlot } = setupGoal(false);
    expect(cont()).toBeNull();
    expect(nestSlot().hidden).toBe(false);
  });

  it("NEST's primary action becomes > CONTINUE once the goal is met", () => {
    const { cont, nestSlot, goalMet } = setupGoal(false);
    act(() => { goalMet.value = true; });
    expect(cont()).not.toBeNull();
    expect(cont()!.textContent).toContain('CONTINUE');
    expect(cont()!.closest('[hidden]')).toBeNull();
    expect(nestSlot().hidden).toBe(true);
  });

  it('tapping CONTINUE calls the action', () => {
    const { cont, onContinue } = setupGoal(true);
    const b = cont()!;
    fireEvent.pointerDown(b, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(b, { pointerId: 1, button: 0 });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('CONTINUE belongs to NEST: other tabs keep their own primary zone', () => {
    const { cont, view } = setupGoal(true);
    fireEvent.click(view.container.querySelector('[data-tab="wrkr"]')!);
    expect(cont()!.closest('[hidden]')).not.toBeNull();
  });
});

describe('Shell: desktop columns (Story 1.29)', () => {
  afterEach(() => cleanup());

  function setupWide(opts: { wide?: boolean; phase?: Phase; goalMet?: boolean; tabKeys?: readonly string[] } = {}) {
    const ph = signal(opts.phase ?? Phase.COLONY);
    const wide = signal(opts.wide ?? true);
    const goalMet = signal(opts.goalMet ?? false);
    const shell = createTabShell({ phase: ph, affordable: signal(''), goalMet, wide });
    const keys = opts.tabKeys ? signal(opts.tabKeys) : undefined;
    const view = render(
      <Shell shell={shell} legacy={{ mount: vi.fn() }} onContinue={() => ({ ok: true })} tabKeys={keys} />,
    );
    const q = <T extends HTMLElement = HTMLElement>(sel: string) => view.container.querySelector<T>(sel);
    const root = () => q('[data-shell]')!;
    const panel = (id: string) => q(`[data-tab-panel="${id}"]`)!;
    const slot = (id: string) => q(`[data-primary-for="${id}"]`)!;
    const tab = (id: string) => q<HTMLButtonElement>(`[data-tab="${id}"]`)!;
    return { ph, wide, goalMet, shell, view, q, root, panel, slot, tab };
  }

  it('marks the layout: columns on a wide viewport, single column otherwise', () => {
    const { root, wide } = setupWide();
    expect(root().getAttribute('data-layout')).toBe('columns');
    act(() => { wide.value = false; });
    expect(root().getAttribute('data-layout')).toBe('single');
  });

  it('Phase 1 stays a single column even on a wide viewport', () => {
    const { root } = setupWide({ phase: Phase.EGG_LAYING });
    expect(root().getAttribute('data-layout')).toBe('single');
  });

  it('NEST stays in column 1 and BUILD fills columns 2–3 on first visit, each with its own primary zone', () => {
    const { panel, slot } = setupWide();
    expect(panel('nest').hidden).toBe(false);
    expect(panel('build').hidden).toBe(false);
    expect(panel('wrkr').hidden).toBe(true);
    expect(panel('nest').getAttribute('data-column')).toBe('1');
    expect(panel('build').getAttribute('data-column')).toBe('2');
    expect(slot('nest').hidden).toBe(false);
    expect(slot('build').hidden).toBe(false);
    expect(slot('wrkr').hidden).toBe(true);
  });

  it('picking a tab in the rail swaps columns 2–3 and keeps NEST', () => {
    const { panel, slot, tab } = setupWide();
    fireEvent.click(tab('wrkr'));
    expect(panel('nest').hidden).toBe(false);
    expect(panel('wrkr').hidden).toBe(false);
    expect(panel('build').hidden).toBe(true);
    expect(slot('wrkr').hidden).toBe(false);
    expect(slot('build').hidden).toBe(true);
    expect(tab('wrkr').getAttribute('aria-selected')).toBe('true');
  });

  it('picking NEST focuses column 1 and leaves columns 2–3 on the last tab', () => {
    const { panel, tab } = setupWide();
    fireEvent.click(tab('log'));
    fireEvent.click(tab('nest'));
    expect(document.activeElement).toBe(panel('nest'));
    expect(panel('log').hidden).toBe(false);
    expect(tab('nest').getAttribute('aria-selected')).toBe('true');
  });

  it('CONTINUE stays in column 1 while another tab is picked', () => {
    const { q, tab } = setupWide({ goalMet: true });
    fireEvent.click(tab('wrkr'));
    expect(q('[data-action="continue"]')!.closest('[hidden]')).toBeNull();
  });

  it('hides the condensed goal line: the full meter is always on screen in column 1', () => {
    const { q, tab } = setupWide();
    fireEvent.click(tab('wrkr'));
    expect(q('[data-goal-line]')!.hidden).toBe(true);
  });

  it('the rail shows full tab names and number-key hints', () => {
    const { tab, q } = setupWide();
    expect(q('[data-tab-bar]')!.getAttribute('data-rail')).toBe('true');
    expect(tab('wrkr').querySelector('[data-tab-name]')!.textContent).toBe('WORKERS');
    expect(tab('nest').querySelector('[data-tab-key]')!.textContent).toBe('1');
    expect(tab('log').querySelector('[data-tab-key]')!.textContent).toBe('4');
    // The hint is decoration: the accessible name is the tab's name.
    expect(tab('log').querySelector('[data-tab-key]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('the hints follow the remapped tab keys, and show none when there are none', () => {
    const remapped = setupWide({ tabKeys: ['a', 'b', 'c', 'd', 'e'] });
    expect(remapped.tab('wrkr').querySelector('[data-tab-key]')!.textContent).toBe('B');
    cleanup();
    const off = setupWide({ tabKeys: [] });
    expect(off.tab('wrkr').querySelector('[data-tab-key]')).toBeNull();
  });

  it('the phone tab bar keeps its short labels and no key hints', () => {
    const { tab, q } = setupWide({ wide: false });
    expect(q('[data-tab-bar]')!.getAttribute('data-rail')).toBe('false');
    expect(tab('wrkr').textContent).toBe('WRKR');
    expect(q('[data-tab-key]')).toBeNull();
  });

  it('each column keeps its own scroll position', () => {
    const { panel, tab, shell } = setupWide();
    panel('build').scrollTop = 120;
    panel('nest').scrollTop = 40;
    fireEvent.click(tab('wrkr'));
    expect(shell.scrollOf('build')).toBe(120);
    expect(shell.scrollOf('nest')).toBe(40);
  });
});
