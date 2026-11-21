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
});
