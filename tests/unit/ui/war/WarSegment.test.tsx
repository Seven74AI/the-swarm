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
