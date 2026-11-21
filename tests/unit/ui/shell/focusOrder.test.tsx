import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { Phase } from '../../../../src/phases/phases';
import { createTabShell } from '../../../../src/ui/shell/tabShell';
import { Shell } from '../../../../src/ui/shell/Shell';
import { columnFocusOrder } from '../../../../src/ui/shell/focusOrder';

/**
 * Story 1.32 (UX-DR40): on desktop columns, Tab goes strip → rail → column 1
 * and its primary action → columns 2–3 and theirs.
 */
afterEach(cleanup);

function setup() {
  const shell = createTabShell({ phase: signal(Phase.COMBAT), affordable: signal(''), wide: signal(true) });
  const views = {
    strip: <button>strip</button>,
    tabs: { nest: <button>nest</button>, build: <button>build</button> },
    primary: { nest: <button>nest primary</button>, build: <button>build primary</button> },
  };
  render(<Shell shell={shell} views={views} />);
  shell.select('build');
  const button = (name: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === name) as HTMLElement;
  const strip = button('strip');
  const nest = button('nest');
  const nestPrimary = button('nest primary');
  const build = button('build');
  const buildPrimary = button('build primary');
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
