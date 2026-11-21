import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, act, screen } from '@testing-library/preact';
import '@preact/signals';
import { signal } from '@preact/signals-core';
import { Phase } from '../../../../src/phases/phases';
import { Button } from '../../../../src/ui/primitives/Button';
import { Meter } from '../../../../src/ui/primitives/Meter';
import { Card } from '../../../../src/ui/primitives/Card';
import { PriceText } from '../../../../src/ui/build/cost';
import { RESOURCE_BY_ID } from '../../../../src/ui/shell/resourceCatalog';
import { createTabShell } from '../../../../src/ui/shell/tabShell';
import { Shell } from '../../../../src/ui/shell/Shell';
import { TABS } from '../../../../src/data/content/tabs';
import { createSheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openBattleSummary } from '../../../../src/ui/sheets/BattleSummarySheet';
import type { BattleResult } from '../../../../src/systems/BattleSystem';
import { PhaseReveal } from '../../../../src/ui/overlays/PhaseReveal';
import { REVEAL_LINES } from '../../../../src/data/content/phaseReveal';
import { OK } from '../../../../src/actions/result';
import { spoken, spokenText, described, DECORATION } from '../../helpers/a11y';

/**
 * Story 1.32 (UX-DR40, NFR15): typed decoration is hidden from assistive
 * tech, labels expose full words, and typing effects are visual only.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('Button names', () => {
  it('the accessible name is the visible verb and target; the cost line is its description, not its name', () => {
    render(<Button variant="primary" verb="BUY" target="WAREHOUSE" cost="40 FOOD · 1 WORKER" onPress={() => OK} />);
    const btn = screen.getByRole('button', { name: 'BUY WAREHOUSE' });
    // No aria-label overriding the visible text (WCAG 2.5.3, label in name).
    expect(btn.hasAttribute('aria-label')).toBe(false);
    expect(described(btn)).toContain('40 FOOD');
    expect(described(btn)).not.toMatch(DECORATION);
  });

  it('an explicit label still names a button whose face is decoration', () => {
    render(<Button verb="[+]" label="Add one gatherer" onPress={() => OK} />);
    expect(screen.getByRole('button', { name: 'Add one gatherer' })).toBeTruthy();
  });
});

describe('Meter', () => {
  it('a progressbar always has a name, and its text cells are hidden', () => {
    render(<Meter label="Phase goal" value={3} max={10} valueText="30 percent" />);
    const bar = screen.getByRole('progressbar', { name: 'Phase goal' });
    expect([...bar.childNodes].map(spokenText).join('').trim()).toBe('');
  });
});

describe('Cards and prices', () => {
  it('a price reads resource names, never glyphs or separators', () => {
    const { container } = render(<p><PriceText price={{ food: 400, wood: 40 }} /></p>);
    const said = spoken(container.querySelector('p')!);
    expect(said).toContain(RESOURCE_BY_ID.food.name);
    expect(said).toContain(RESOURCE_BY_ID.wood.name);
    expect(said).not.toContain(RESOURCE_BY_ID.food.glyph);
    expect(said).not.toMatch(DECORATION);
  });

  it('a card reads its level change and shortfall in words', () => {
    const { container } = render(
      <Card
        title="WALLS"
        level="LV.1 → 2"
        cost="500 STONE · 20 WOOD"
        affordable={false}
        shortfall={{ amount: 7, glyph: '△' }}
        action={<span />}
      />,
    );
    const said = spoken(container.querySelector('article')!);
    expect(said).not.toMatch(DECORATION);
    expect(said).toContain('needs 7 more');
  });
});

describe('Tab bar', () => {
  it('phone tabs show their short label but are named with the full word', () => {
    const shell = createTabShell({ phase: signal(Phase.COMBAT), affordable: signal('') });
    render(<Shell shell={shell} />);
    for (const t of TABS) {
      const el = document.querySelector<HTMLElement>(`[data-tab="${t.id}"]`);
      if (!el) continue;
      expect(spoken(el)).toBe(t.railLabel);
    }
  });

  it('the condensed goal line is a named region', () => {
    const shell = createTabShell({ phase: signal(Phase.COLONY), affordable: signal('') });
    render(<Shell shell={shell} />);
    const line = document.querySelector('[data-goal-line]')!;
    expect(line.getAttribute('role')).toBe('region');
    expect(line.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('Battle summary', () => {
  const r: BattleResult = {
    victory: true,
    outcome: 'draw',
    rounds: 4,
    soldiersLost: 5,
    enemyType: 'beetle',
    foodGained: 3,
    specialLoot: { chitin: 2, silk: 0, venom: 1 },
    poisonDamageDealt: 0,
    narrative: 'x',
  };
  it('reads full resource names and no decoration', () => {
    const sheets = createSheetController();
    render(<SheetHost sheets={sheets} />);
    act(() => {
      openBattleSummary(sheets, r, 'Beetle');
    });
    const said = spoken(document.querySelector('[data-battle-summary]')!);
    expect(said, said).not.toMatch(DECORATION);
    expect(said).toMatch(/Chitin/);
    expect(said).toMatch(/Venom/);
  });
});

describe('Phase reveal typing', () => {
  beforeEach(() => vi.useFakeTimers());
  it('the accessible line holds the full string from the start while it types in', () => {
    render(<PhaseReveal phase={Phase.COLONY} skippable={false} reducedMotion={false} done={() => {}} />);
    const line = document.querySelector<HTMLElement>('[data-reveal-line]')!;
    // Nothing typed yet on screen…
    expect(line.querySelector('[aria-hidden="true"]')!.textContent).toBe('');
    // …but the full line is there for assistive tech, and no aria-label on a paragraph.
    expect(spoken(line)).toBe(REVEAL_LINES[Phase.COLONY]);
    expect(line.hasAttribute('aria-label')).toBe(false);
  });
});
