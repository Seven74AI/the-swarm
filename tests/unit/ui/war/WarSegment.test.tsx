import { combatBalance } from '../../../../src/data/balance/combat';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { MUTATIONS } from '../../../../src/systems/MutationSystem';
import { soldierBalance } from '../../../../src/data/balance/soldiers';
import { createWarSession, type WarSession } from '../../../../src/ui/war/warSession';
import { CombatLog, EnemyCard, MutationsSection, SoldiersSection, WarPrimary } from '../../../../src/ui/war/WarSegment';
import type { SegmentId } from '../../../../src/data/content/tabs';
import { testActions } from '../../helpers/actions';
import { makeState, type StateOverrides } from '../../helpers/makeState';
import { visibleText } from '../../helpers/a11y';
import { ENEMIES, TRAITS, enemyCardTitle } from '../../../../src/data/content/enemies';
import { marksOf } from '../../../../src/systems/Counters';

/**
 * Story 1.25 (UX-DR10, UX-DR26): FRONT → WAR. Soldiers and training,
 * equipment, mutations, the enemy card and the combat log, with `> FIGHT` as
 * the primary action.
 */

const tap = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
};

let session: WarSession;
const segment = signal<SegmentId | null>('war');

function seed(over: StateOverrides = {}): void {
  gameState.value = makeState({
    phase: Phase.COMBAT,
    resources: { workers: 10, food: 1000, nestCapacity: 1000 },
    workersAssigned: { gather: 2, tend: 0, dig: 0, guard: 0, researchers: 0 },
    ...over,
  });
}

function mount() {
  const actions = testActions();
  session = createWarSession({ actions, onBattleDone: () => {} });
  return render(
    <>
      <div id="soldier-panel"><SoldiersSection actions={actions} /></div>
      <div id="mutation-panel"><MutationsSection actions={actions} /></div>
      <div id="battle-panel"><EnemyCard session={session} /></div>
      <div id="combat-log-panel"><CombatLog session={session} /></div>
      <div data-primary=""><WarPrimary session={session} segment={segment} /></div>
    </>,
  ).container;
}

beforeEach(() => {
  vi.useFakeTimers();
  segment.value = 'war';
  seed();
});
afterEach(() => {
  cleanup();
  session?.dispose();
  vi.useRealTimers();
});

const fightBtn = (c: ParentNode) => c.querySelector<HTMLElement>('[data-action="fight"]');

describe('WAR segment (Story 1.25)', () => {
  it('shows the soldiers and the ones in training', () => {
    seed({ combatSoldiers: 7, soldierPipeline: { count: 3, progress: 0.5 } });
    const c = mount();
    expect(c.querySelector('[data-soldiers]')!.textContent).toContain('7');
    expect(c.querySelector('[data-training]')!.textContent).toContain('3');
    expect(c.querySelector('#soldier-panel [role="progressbar"]')).not.toBeNull();
  });

  it('TRAIN sends a free worker to training for food', () => {
    const c = mount();
    const before = gameState.value;
    act(() => tap(c.querySelector('[data-action="train-soldier"]')!));
    expect(gameState.value.soldierPipeline.count).toBeGreaterThan(before.soldierPipeline.count);
    expect(gameState.value.resources.food).toBeLessThan(before.resources.food);
  });

  it('TRAIN says why it is disabled: no free workers, or not enough food', () => {
    seed({ workersAssigned: { gather: 10, tend: 0, dig: 0, guard: 0, researchers: 0 } });
    let c = mount();
    const btn = () => c.querySelector<HTMLElement>('[data-action="train-soldier"]')!;
    expect(btn().getAttribute('aria-disabled')).toBe('true');
    expect(c.querySelector('#soldier-panel')!.textContent).toContain('no free workers');
    cleanup();
    seed({ resources: { workers: 10, food: soldierBalance.costFood - 1, nestCapacity: 1000 } });
    c = mount();
    expect(btn().getAttribute('aria-disabled')).toBe('true');
    expect(c.querySelector('#soldier-panel')!.textContent).toMatch(/needs \d+ more food/i);
  });

  it('shows what the army eats next to the soldier count, growing with the army (Story 4.4)', () => {
    const upkeep = (c: ParentNode) => {
      const el = c.querySelector('[data-army-upkeep]');
      expect(el, 'an upkeep readout next to the soldiers').not.toBeNull();
      expect(el!.closest('.war-line')).toBe(c.querySelector('[data-soldiers]')!.closest('.war-line'));
      return Number((el!.textContent ?? '').replace(/[^\d.]/g, ''));
    };
    seed({ combatSoldiers: 4, soldierPipeline: { count: 0, progress: 0 } });
    let c = mount();
    const small = upkeep(c);
    expect(small).toBeGreaterThan(0);
    expect(c.querySelector('[data-army-upkeep]')!.textContent).toMatch(/FOOD/);
    cleanup();
    seed({ combatSoldiers: 40, soldierPipeline: { count: 2, progress: 0 } });
    c = mount();
    expect(upkeep(c)).toBeGreaterThan(small);
  });

  it('TRAIN names its ongoing cost: a worker, and what the new eater will eat (Stories 4.4, 9.12)', () => {
    const c = mount();
    const cost = c.querySelector('[data-action="train-soldier"]')!.closest('[data-button]') ?? c.querySelector('#soldier-panel')!;
    expect(cost.textContent).toMatch(/1 WORKER/);
    expect(cost.textContent).toMatch(/\+[\d.]+\/S\W*food a second\W*EATEN|\+[\d.]+\/S.*EATEN/);
    expect(c.querySelector('[data-new-eater]')!.textContent).toContain(String(Math.floor(combatBalance.army.upkeepFoodPerSec * 100) / 100));
  });

  it('TRAIN is disabled while the colony starves, and says so (Story 4.4)', () => {
    // An empty store and an army that eats more than ten workers make.
    seed({ resources: { workers: 10, food: 0, nestCapacity: 1000 }, combatSoldiers: 1_000 });
    const c = mount();
    expect(c.querySelector('[data-action="train-soldier"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(c.querySelector('#soldier-panel')!.textContent).toMatch(/starving/i);
  });

  it('shows weapons and armour as cards, locked behind their buildings', () => {
    const c = mount();
    for (const id of ['weapon', 'armor']) {
      const card = c.querySelector(`[data-card="equipment-${id}"]`)!;
      expect(card).not.toBeNull();
      expect(card.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');
    }
    expect(c.querySelector('[data-card="equipment-weapon"]')!.textContent).toMatch(/chitin armory/i);
  });

  it('upgrades weapons once the armory stands and chitin is in stock', () => {
    seed({ buildings: { chitin_armory: { level: 1 } }, combatResources: { chitin: 1000 } });
    const c = mount();
    const before = gameState.value.equipment.weapon;
    act(() => tap(c.querySelector('[data-card="equipment-weapon"] button')!));
    expect(gameState.value.equipment.weapon).toBeGreaterThan(before);
  });

  it('has one card per mutation, keeping #mutation-card-<id>, and buys one', () => {
    const free = MUTATIONS.find((m) => m.prerequisite === null)!;
    seed({ combatResources: { chitin: 1000, silk: 1000, venom: 1000 } });
    const c = mount();
    for (const m of MUTATIONS) expect(c.querySelector(`#mutation-card-${m.id}`), m.id).not.toBeNull();
    act(() => tap(c.querySelector(`#mutation-card-${free.id} button`)!));
    expect(gameState.value.mutations.find((m) => m.id === free.id)?.purchased).toBe(true);
    expect(c.querySelector(`#mutation-card-${free.id} [data-mutation-status="owned"]`)).not.toBeNull();
  });

  it('a mutation behind another says what it needs', () => {
    const gated = MUTATIONS.find((m) => m.prerequisite !== null)!;
    const c = mount();
    const card = c.querySelector(`#mutation-card-${gated.id}`)!;
    expect(card.querySelector('[data-mutation-status="locked"]')).not.toBeNull();
    const pre = MUTATIONS.find((m) => m.id === gated.prerequisite)!;
    expect(card.textContent!.toUpperCase()).toContain(pre.name.toUpperCase());
  });

  it('the enemy card titles the enemy with its trait before the fight: ARMORED BEETLE · THICK SHELL (Story 4.1)', () => {
    gameState.value = { ...gameState.value, nextEnemy: 'beetle' };
    const c = mount();
    const card = c.querySelector('#battle-panel [data-war="enemy"]')!;
    expect(card.getAttribute('data-trait')).toBe(ENEMIES.beetle.trait);
    const title = visibleText(card.querySelector('.card__name')!);
    expect(title.replace(/\s+/g, ' ').trim()).toBe(enemyCardTitle('beetle'));
    expect(card.querySelector('[data-enemy-trait]')!.textContent).toBe(TRAITS[ENEMIES.beetle.trait].label);
    expect(card.querySelector('[data-trait-line]')!.textContent).toBe(TRAITS[ENEMIES.beetle.trait].line);
  });

  it('the enemy card names the enemy FIGHT will fight, with #enemy-name', () => {
    const c = mount();
    const name = c.querySelector('#battle-panel #enemy-name')!;
    expect(name.textContent!.toUpperCase()).toBe(session.enemy.value.name.toUpperCase());
    expect(c.querySelector('#battle-panel [data-matchup]')).not.toBeNull();
  });

  it('> FIGHT is disabled with "train soldiers first" when there are no soldiers', () => {
    const c = mount();
    const btn = fightBtn(c)!;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(c.querySelector('[data-primary]')!.textContent).toContain('train soldiers first');
    const before = gameState.value;
    act(() => tap(btn));
    expect(gameState.value).toBe(before);
  });

  it('> FIGHT shows only in the WAR segment', () => {
    const c = mount();
    expect(fightBtn(c)).not.toBeNull();
    act(() => {
      segment.value = 'map';
    });
    expect(fightBtn(c)).toBeNull();
  });

  it('a running battle shows a round counter on the enemy card; the log gets the battle at the end', () => {
    seed({ combatSoldiers: 50, equipment: { weapon: 5, armor: 5 } });
    const c = mount();
    expect(c.querySelector('[data-round]')).toBeNull();
    expect(c.querySelector('#combat-log-panel [data-empty]')).not.toBeNull();
    act(() => tap(fightBtn(c)!));
    expect(c.querySelector('#battle-panel [data-round]')!.textContent).toMatch(/ROUND \d+/);
    expect(fightBtn(c)!.getAttribute('aria-disabled')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(session.maxReplayMs);
    });
    expect(c.querySelector('[data-round]')).toBeNull();
    const line = c.querySelector('#combat-log-panel [data-battle-line]')!;
    expect(line.textContent).toMatch(/VICTORY|DEFEAT|DRAW/);
  });

  it('the combat log shows the saved last battle after a reload', () => {
    seed({ lastBattle: { status: 'done', enemyType: 'termite', result: 'draw', soldiersLost: 1, foodGained: 0, atMs: 0 } });
    const c = mount();
    expect(c.querySelector('#combat-log-panel [data-battle-line]')!.textContent).toMatch(/DRAW/);
  });
});

describe('counter lines (Story 4.2)', () => {
  it('each mutation card names the traits it is strong against', () => {
    const c = mount();
    for (const m of MUTATIONS) {
      const text = visibleText(c.querySelector(`[data-mutation="${m.id}"]`)!);
      for (const t of marksOf({ kind: 'mutation', id: m.id }).strongAgainst) expect(text, m.id).toContain(TRAITS[t].label);
    }
  });

  it('each equipment card names what its next level is strong against', () => {
    seed({ equipment: { weapon: 2, armor: 0 } });
    const c = mount();
    for (const [id, level] of [['weapon', 3], ['armor', 1]] as const) {
      const text = visibleText(c.querySelector(`[data-card="equipment-${id}"]`)!);
      for (const t of marksOf({ kind: 'equipment', id, level }).strongAgainst) expect(text, id).toContain(TRAITS[t].label);
    }
  });
});
