import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { Phase } from '../../../../src/phases/phases';
import { createTabShell } from '../../../../src/ui/shell/tabShell';
import { Shell } from '../../../../src/ui/shell/Shell';
import { columnFocusOrder } from '../../../../src/ui/shell/focusOrder';
import type { ShellHosts } from '../../../../src/ui/shell/hosts';
import { PANEL_PLACEMENT } from '../../../../src/data/content/tabs';

/**
 * Story 1.32 (UX-DR40): on desktop columns, Tab goes strip → rail → column 1
 * and its primary action → columns 2–3 and theirs.
 */
afterEach(cleanup);

function setup() {
  const shell = createTabShell({ phase: signal(Phase.COMBAT), affordable: signal(''), wide: signal(true) });
  let hosts!: ShellHosts;
  render(<Shell shell={shell} legacy={{ mount: (h) => (hosts = h) }} />);
  shell.select('build');
  const add = (host: HTMLElement, name: string) => {
    const b = document.createElement('button');
    b.textContent = name;
    host.appendChild(b);
    return b;
  };
  const strip = add(hosts.strip, 'strip');
  const nest = add(hosts.host(PANEL_PLACEMENT.event_log), 'nest');
  const nestPrimary = add(hosts.host(PANEL_PLACEMENT.click_button), 'nest primary');
  const build = add(hosts.host(PANEL_PLACEMENT.build_header), 'build');
  const buildPrimary = add(hosts.host(PANEL_PLACEMENT.build_primary), 'build primary');
  return { strip, nest, nestPrimary, build, buildPrimary };
}

describe('desktop focus order', () => {
  it('lists the focusable controls column by column', () => {
    const t = setup();
    const order = columnFocusOrder(document.querySelector<HTMLElement>('[data-shell]')!);
    const at = (el: HTMLElement) => order.indexOf(el);
    const rail = document.querySelector<HTMLElement>('[data-tab="nest"]')!;
    expect(at(t.strip)).toBeLessThan(at(rail));
    expect(at(rail)).toBeLessThan(at(t.nest));
    expect(at(t.nest)).toBeLessThan(at(t.nestPrimary));
    expect(at(t.nestPrimary)).toBeLessThan(at(t.build));
    expect(at(t.build)).toBeLessThan(at(t.buildPrimary));
  });

  it('Tab and Shift+Tab move along that order', () => {
    const t = setup();
    t.nestPrimary.focus();
    fireEvent.keyDown(t.nestPrimary, { key: 'Tab' });
    expect(document.activeElement).toBe(t.build);
    fireEvent.keyDown(t.build, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(t.nestPrimary);
  });
});
