import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { createSheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openBattleSummary } from '../../../../src/ui/sheets/BattleSummarySheet';
import type { BattleResult } from '../../../../src/systems/BattleSystem';

/** Story 1.25 (via 1.14's battle priority): the battle's result opens as a summary sheet. */

const result = (over: Partial<BattleResult> = {}): BattleResult => ({
  victory: false,
  outcome: 'defeat',
  rounds: 4,
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

function open(r: BattleResult) {
  const sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
  act(() => {
    openBattleSummary(sheets, r, 'Beetle');
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
