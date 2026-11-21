import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { confirmSettings, holdFor } from '../../helpers/confirm';
import { testActions } from '../../helpers/actions';
import { gameState } from '../../../../src/state/gameSignal';
import { EventBus } from '../../../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../../../src/state/GameState';
import { PHASE_ORDER } from '../../../../src/phases/phases';
import { calculateLegacyPoints, getPhaseScore, legacyPointsAward } from '../../../../src/state/queries';
import { ENTROPY_MAX } from '../../../../src/systems/EntropySystem';
import { progressionBalance } from '../../../../src/data/balance/progression';
import { PERCENT } from '../../../../src/data/constants';
import { PRESTIGE_UPGRADES } from '../../../../src/data/prestigeTree';
import { PrestigeCard, PrestigeTree } from '../../../../src/ui/log/Prestige';
import { getUnmetRequirements } from '../../../../src/state/queries';
import { prestigeBalance } from '../../../../src/data/balance/prestige';
import { formatFull } from '../../../../src/utils/format';
import { colonyVoiceProblem } from '../../../arch/voice';
import { visibleText } from '../../helpers/a11y';

/**
 * Story 1.36: LOG → LEGACY's prestige card and Legacy tree are Preact views,
 * replacing the legacy PrestigePanel and PrestigeTreePanel. Their hooks stay:
 * `#prestige-panel`, `.btn-prestige` (`data-action="prestige"`), `.btn-tree`,
 * `.stat-row`/`.stat-value`, `#prestige-tree-panel`, `.prestige-tree-card`,
 * `.prestige-tree-card-name`, `.btn-tree-purchase`, `.prestige-tree-purchased-badge`.
 */
afterEach(() => cleanup());

const readyBuildings = (s: GameState) => ({
  ...s.buildings,
  barracks: { level: 5, count: 0 },
  walls: { level: 5 },
  warehouse: { level: 5 },
});
const ready = (food = 100_000): GameState => {
  const s = createInitialState();
  return {
    ...s,
    buildings: readyBuildings(s),
    prestige: { ...s.prestige, totalFoodProduced: food, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
  };
};
const set = (s: GameState) => act(() => void (gameState.value = s));

function card(settings = confirmSettings()) {
  const bus = new EventBus();
  let fired = 0;
  bus.subscribe('prestige_triggered', () => void fired++);
  const view = render(<PrestigeCard actions={testActions(bus)} confirmSettings={settings} />);
  const panel = () => view.container.querySelector<HTMLElement>('#prestige-panel')!;
  const btn = () => panel().querySelector<HTMLButtonElement>('.btn-prestige')!;
  const stat = (label: string) =>
    [...panel().querySelectorAll('.stat-row')].find((r) => r.textContent?.includes(label))?.querySelector('.stat-value')?.textContent;
  return { view, panel, btn, stat, fired: () => fired };
}

describe('PrestigeCard', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });

  it('keeps the #prestige-panel hooks and explains prestige on the panel', () => {
    const { panel } = card();
    expect(panel().classList.contains('prestige-panel')).toBe(true);
    expect(panel().textContent).toContain('Legacy Prestige');
    expect(panel().getAttribute('data-tooltip')).toContain('Reset');
    expect(panel().getAttribute('data-panel')).toBe('prestige_panel');
  });

  it('shows the legacy points and prestige count, following them', () => {
    const { stat } = card();
    expect(stat('Legacy Points')).toBe('0');
    set({ ...gameState.value, prestige: { ...gameState.value.prestige, legacyPoints: 5, count: 3 } });
    expect(stat('Legacy Points')).toBe('5');
    expect(stat('🔄 Legacy')).toBe('3');
  });

  it('PRESTIGE is disabled with the unmet requirements until they are met', () => {
    const { btn } = card();
    expect(btn().getAttribute('aria-disabled')).toBe('true');
    set(ready());
    expect(btn().getAttribute('aria-disabled')).toBeNull();
    expect(btn().classList.contains('prestige-ready')).toBe(true);
  });

  describe('lists what prestige still needs, in the colony voice (Story 5.1)', () => {
    const needs = (panel: HTMLElement) => panel.querySelector<HTMLElement>('[data-prestige-needs]');
    const lines = (panel: HTMLElement) => [...panel.querySelectorAll<HTMLElement>('li[data-requirement]')];

    it('shows one line per unmet requirement, each with where it stands and what it needs', () => {
      const s = createInitialState();
      gameState.value = s;
      const { panel } = card();
      const unmet = getUnmetRequirements(s);
      expect(unmet.length).toBeGreaterThan(0);
      expect(lines(panel()).map((l) => l.dataset.requirement)).toEqual(unmet.map((u) => u.id));
      for (const [i, li] of lines(panel()).entries()) {
        const text = visibleText(li);
        expect(colonyVoiceProblem(text), text).toBeNull();
        expect(text).toContain(formatFull(unmet[i].target));
        expect(text).toContain(formatFull(unmet[i].current));
      }
      const lead = visibleText(needs(panel())!.querySelector<HTMLElement>('[data-prestige-needs-lead]')!);
      expect(colonyVoiceProblem(lead), lead).toBeNull();
    });

    it('drops a line the moment its requirement is met, and the list once all are', () => {
      const { buildingLevels } = prestigeBalance.unlock;
      const short = ready();
      const partly = { ...short, buildings: { ...short.buildings, walls: { level: buildingLevels.walls - 1 } } };
      gameState.value = partly;
      const { panel } = card();
      expect(lines(panel()).map((l) => l.dataset.requirement)).toEqual(['walls']);
      set(ready());
      expect(needs(panel())).toBeNull();
    });
  });

  for (const phase of PHASE_ORDER) {
    it(`previews the points prestige() awards in ${phase} (#188)`, () => {
      const s = { ...ready(1_000_000_000), phase };
      gameState.value = s;
      const { panel } = card();
      const value = panel().querySelector('.stat-row.projected .stat-value')?.textContent;
      expect(value).toBe(`+${calculateLegacyPoints(s.prestige.totalFoodProduced, getPhaseScore(phase))} LP`);
    });
  }

  it('previews the whole award, entropy bonus included (Story 5.2)', () => {
    const s = { ...ready(1_000_000_000), phase: PHASE_ORDER[PHASE_ORDER.length - 1], entropy: ENTROPY_MAX };
    gameState.value = s;
    const { panel } = card();
    const value = panel().querySelector('.stat-row.projected .stat-value')?.textContent;
    expect(legacyPointsAward(s)).toBeGreaterThan(calculateLegacyPoints(s.prestige.totalFoodProduced, getPhaseScore(s.phase)));
    expect(value).toBe(`+${legacyPointsAward(s)} LP`);
  });

  describe('the production bonus counts lifetime LP (Story 5.2, FR29)', () => {
    const bonusPercent = (lp: number) => Math.round(lp * progressionBalance.productionPerLegacyPoint * PERCENT);

    it('shows +percent of the LP ever earned, not the LP held', () => {
      const s = createInitialState();
      gameState.value = { ...s, prestige: { ...s.prestige, legacyPoints: 2, lifetimeLpEarned: 9 } };
      const { stat } = card();
      expect(stat('Production Bonus')).toBe(`+${bonusPercent(9)}%`);
    });

    it('does not drop when LP is spent', () => {
      const s = createInitialState();
      gameState.value = { ...s, prestige: { ...s.prestige, legacyPoints: 9, lifetimeLpEarned: 9 } };
      const { stat } = card();
      const before = stat('Production Bonus');
      set({ ...gameState.value, prestige: { ...gameState.value.prestige, legacyPoints: 0 } });
      expect(stat('Production Bonus')).toBe(before);
    });

    it('is hidden until any LP has been earned, and the tip names the per-LP share', () => {
      const { stat, panel } = card();
      expect(stat('Production Bonus')).toBeUndefined();
      expect(panel().getAttribute('data-tooltip')).toContain(`+${bonusPercent(1)}%`);
    });
  });

  it('keeps the same PRESTIGE node when a tick changes nothing it shows (#186)', () => {
    const { btn } = card();
    const before = btn();
    set({ ...gameState.value, resources: { ...gameState.value.resources, food: gameState.value.resources.food + 1 } });
    set({ ...gameState.value, prestige: { ...gameState.value.prestige, legacyPoints: 2 } });
    expect(btn()).toBe(before);
  });

  describe('prestige needs a deliberate confirm (Story 1.13)', () => {
    beforeEach(() => {
      gameState.value = ready();
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('a plain click does not prestige', () => {
      const c = card();
      c.btn().click();
      vi.advanceTimersByTime(5000);
      expect(c.fired()).toBe(0);
      expect(gameState.value.prestige.count).toBe(0);
    });

    it('a hold shorter than the setting does not prestige; a full hold does, once', () => {
      const settings = confirmSettings({ confirmHoldMs: 2000 });
      const c = card(settings);
      holdFor(c.btn(), settings.value.confirmHoldMs - 1);
      vi.advanceTimersByTime(5000);
      expect(c.fired()).toBe(0);
      holdFor(c.btn(), settings.value.confirmHoldMs, 2);
      expect(c.fired()).toBe(1);
      expect(gameState.value.prestige.count).toBeGreaterThan(0);
    });

    it('two-tap mode: the first tap arms, the second prestiges', () => {
      const c = card(confirmSettings({ confirmStyle: 'twoTaps' }));
      c.btn().click();
      expect(c.fired()).toBe(0);
      c.btn().click();
      expect(c.fired()).toBe(1);
    });

    it('a disabled PRESTIGE never fires', () => {
      gameState.value = createInitialState();
      const c = card();
      c.btn().click();
      holdFor(c.btn(), 5000);
      expect(c.fired()).toBe(0);
    });
  });
});

describe('PrestigeTree', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });

  const tree = () => {
    const view = render(<PrestigeTree actions={testActions()} />);
    const cardOf = (name: string) =>
      [...view.container.querySelectorAll<HTMLElement>('#prestige-tree-panel .prestige-tree-card')].find(
        (c) => c.querySelector('.prestige-tree-card-name')?.textContent === name,
      )!;
    return { view, cardOf };
  };

  it('shows one card per upgrade, none buyable without legacy points', () => {
    const { view } = tree();
    expect(view.container.querySelectorAll('.prestige-tree-card')).toHaveLength(PRESTIGE_UPGRADES.length);
    for (const b of view.container.querySelectorAll<HTMLButtonElement>('.btn-tree-purchase')) expect(b.disabled).toBe(true);
  });

  it('buys an upgrade it can afford, which then shows as owned', () => {
    const upgrade = PRESTIGE_UPGRADES.find((u) => u.prerequisites.length === 0)!;
    set({ ...gameState.value, prestige: { ...gameState.value.prestige, legacyPoints: upgrade.cost } });
    const { cardOf } = tree();
    const btn = cardOf(upgrade.name).querySelector<HTMLButtonElement>('.btn-tree-purchase')!;
    expect(btn.disabled).toBe(false);
    act(() => btn.click());
    expect(gameState.value.prestigeTree.purchased).toContain(upgrade.id);
    expect(gameState.value.prestige.legacyPoints).toBeLessThan(upgrade.cost);
    expect(cardOf(upgrade.name).querySelector('.prestige-tree-purchased-badge')).not.toBeNull();
  });
});
