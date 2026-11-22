import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openBattleSummary } from '../../../../src/ui/sheets/BattleSummarySheet';
import type { BattleResult } from '../../../../src/systems/BattleSystem';
import type { BattleAdvice, CounterCard } from '../../../../src/systems/Counters';
import { causeLine } from '../../../../src/systems/BattleCauses';
import { visibleText } from '../../helpers/a11y';

/** Story 1.25 (via 1.14's battle priority): the battle's result opens as a summary sheet. */

const result = (over: Partial<BattleResult> = {}): BattleResult => ({
  victory: false,
  outcome: 'defeat',
  rounds: 4,
  cause: { kind: 'trait_beat_mutation', trait: 'thick_shell', upgrade: 'potent_venom' },
  soldiersLost: 5,
  enemyType: 'beetle',
  foodGained: 0,
  specialLoot: { chitin: 0, silk: 0, venom: 0 },
  poisonDamageDealt: 0,
  narrative: 'x',
  ...over,
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function open(r: BattleResult, opts?: Parameters<typeof openBattleSummary>[3]) {
  const sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
  act(() => {
    openBattleSummary(sheets, r, 'Beetle', opts);
  });
  return { sheets, sheet: () => document.querySelector<HTMLElement>('[data-battle-summary]') };
}

describe('battle summary sheet (Story 1.25)', () => {
  it('opens at battle priority with the outcome as its headline', () => {
    for (const [outcome, word] of [['victory', 'VICTORY'], ['defeat', 'DEFEAT'], ['draw', 'DRAW']] as const) {
      const { sheets, sheet } = open(result({ outcome, victory: outcome === 'victory' }));
      expect(sheets.state.value.open?.priority).toBe('battle');
      expect(sheet()!.getAttribute('data-outcome')).toBe(outcome);
      expect(sheet()!.querySelector('[data-sheet-headline]')!.textContent).toContain(word);
      expect(sheet()!.id).toBe('battle-result');
      cleanup();
      document.body.replaceChildren();
    }
  });

  it('shows the losses, the enemy, and only the drops that came', () => {
    const { sheet } = open(result({ outcome: 'victory', victory: true, soldiersLost: 2, foodGained: 30, specialLoot: { chitin: 3, silk: 0, venom: 0 } }));
    expect(sheet()!.querySelector('[data-losses]')!.textContent).toContain('2');
    expect(sheet()!.querySelector('[data-drop="food"]')).not.toBeNull();
    expect(sheet()!.querySelector('[data-drop="chitin"]')).not.toBeNull();
    expect(sheet()!.querySelector('[data-drop="silk"]')).toBeNull();
    expect(sheet()!.textContent!.toUpperCase()).toContain('BEETLE');
  });
});

const card = (over: Partial<CounterCard> = {}): CounterCard => ({
  ref: { kind: 'mutation', id: 'reinforced_mandibles' },
  key: 'mutation:reinforced_mandibles',
  cost: { chitin: 8 },
  affordable: true,
  target: 'REINFORCED MANDIBLES',
  ...over,
});
const advice = (over: Partial<BattleAdvice> = {}): BattleAdvice => ({ counter: card(), shortfall: null, alternative: null, ...over });

describe('battle summary: the cause and the change (Story 4.3)', () => {
  it('shows the draw headline the story names', () => {
    const { sheet } = open(result({ outcome: 'draw' }));
    expect(visibleText(sheet()!.querySelector('[data-sheet-headline]')!)).toContain('DRAW · THEY RETREATED.');
  });

  it('shows one cause line in the colony voice, for every outcome', () => {
    for (const outcome of ['victory', 'defeat', 'draw'] as const) {
      const r = result({ outcome, victory: outcome === 'victory' });
      const { sheet } = open(r);
      const lines = sheet()!.querySelectorAll('[data-cause]');
      expect(lines).toHaveLength(1);
      expect(lines[0]!.getAttribute('data-cause')).toBe(r.cause.kind);
      expect(lines[0]!.textContent).toBe(causeLine(r.cause));
      cleanup();
      document.body.replaceChildren();
    }
  });

  it('> CHANGE → <card> opens the counter card and closes the sheet', () => {
    const opened: CounterCard[] = [];
    const { sheets, sheet } = open(result(), { advice: advice(), onChange: (c) => opened.push(c) });
    const change = sheet()!.querySelector<HTMLButtonElement>('button[data-action="change"]')!;
    expect(change.getAttribute('data-counter')).toBe('mutation:reinforced_mandibles');
    expect(visibleText(change)).toMatch(/CHANGE → REINFORCED MANDIBLES/);
    act(() => change.click());
    expect(opened.map((c) => c.key)).toEqual(['mutation:reinforced_mandibles']);
    expect(sheets.state.value.open).toBeNull();
  });

  it('an unaffordable counter shows its shortfall, and a cheaper one the colony can pay for', () => {
    const alt = card({ ref: { kind: 'equipment', id: 'weapon' }, key: 'equipment:weapon', target: 'WEAPONS LV.2', cost: { chitin: 2 } });
    const { sheet } = open(result(), {
      advice: advice({ counter: card({ affordable: false }), shortfall: { resource: 'chitin', amount: 3 }, alternative: alt }),
      onChange: () => {},
    });
    const change = sheet()!.querySelector('button[data-action="change"]')!;
    expect(change.querySelector('[data-cost]')!.textContent).toMatch(/needs 3 more chitin/i);
    const cheaper = sheet()!.querySelector('[data-counter-alt]')!;
    expect(cheaper.getAttribute('data-counter-alt')).toBe('equipment:weapon');
    expect(visibleText(cheaper)).toContain('WEAPONS LV.2');
  });

  it('no change after a victory, nor when no counter is open', () => {
    const won = open(result({ outcome: 'victory', victory: true, cause: { kind: 'outfought', trait: 'swarm' } }), { advice: advice(), onChange: () => {} });
    expect(won.sheet()!.querySelector('[data-action="change"]')).toBeNull();
    cleanup();
    document.body.replaceChildren();
    const none = open(result(), { advice: advice({ counter: null }), onChange: () => {} });
    expect(none.sheet()!.querySelector('[data-action="change"]')).toBeNull();
    expect(none.sheet()!.querySelector('[data-cause]')).not.toBeNull();
  });
});

describe('battle summary game feel (Story 8.9)', () => {
  it('the headline types in, for every outcome', () => {
    for (const outcome of ['victory', 'defeat', 'draw'] as const) {
      const { sheet } = open(result({ outcome, victory: outcome === 'victory' }));
      const typed = sheet()!.querySelector('[data-sheet-headline] [data-type-in]');
      expect(typed, outcome).not.toBeNull();
      expect(typed!.getAttribute('style') ?? '', outcome).toContain('--type-in-chars');
      cleanup();
      document.body.replaceChildren();
    }
  });
});
