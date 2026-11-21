import { describe, expect, it } from 'vitest';
import { counterFor, marksOf, upgradeOf, type BattleCause } from '../../src/systems/Counters';
import { itemCost, itemKey } from '../../src/systems/NextAction';
import { MUTATIONS } from '../../src/systems/MutationSystem';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { TRAITS, type TraitId } from '../../src/data/content/enemies';
import type { ItemRef } from '../../src/data/content/criticalPath';
import type { GameState } from '../../src/state/GameState';
import { makeState, type StateOverrides } from './helpers/makeState';

/**
 * Story 4.2: `counterFor(cause, state)` is the card the battle summary (Story
 * 4.3) points at: the cheapest card the player holds or can buy that is
 * marked strong against the trait behind the cause.
 */

const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
const CAUSE_KINDS: BattleCause['kind'][] = ['trait_beat_mutation', 'trait_beat_equipment', 'outnumbered', 'equipment_gap'];

/** A Combat colony with both workshops built: every equipment card and every root mutation is open. */
const armed = (over: StateOverrides = {}): GameState =>
  makeState({ phase: 'combat', buildings: { chitin_armory: { level: 1 }, silk_weaving: { level: 1 }, venom_lab: { level: 1 } }, ...over });

const total = (ref: ItemRef, s: GameState): number => Object.values(itemCost(s, ref) ?? {}).reduce((a, b) => a + (b ?? 0), 0);
/** Every open counter card for the trait, as `counterFor` may choose from. */
function candidates(s: GameState, trait: TraitId, only?: ItemRef['kind']): ItemRef[] {
  const refs: ItemRef[] = [
    ...MUTATIONS.map((m): ItemRef => ({ kind: 'mutation', id: m.id })),
    { kind: 'equipment', id: 'weapon' },
    { kind: 'equipment', id: 'armor' },
  ];
  return refs.filter(
    (r) => (only === undefined || r.kind === only) && itemCost(s, r) !== null && marksOf(upgradeOf(r, s)).strongAgainst.includes(trait),
  );
}

describe('counterFor (Story 4.2)', () => {
  it('every trait has a counter card from a fresh Combat colony with its workshops', () => {
    for (const trait of TRAIT_IDS) expect(counterFor({ kind: 'trait_beat_mutation', trait }, armed()), trait).not.toBeNull();
  });

  it('returns an open card marked strong against the trait, and the cheapest of them', () => {
    const s = armed();
    for (const trait of TRAIT_IDS) {
      for (const kind of CAUSE_KINDS) {
        const c = counterFor({ kind, trait }, s);
        if (c === null) continue;
        expect(itemCost(s, c.ref)).not.toBeNull();
        expect(marksOf(upgradeOf(c.ref, s)).strongAgainst).toContain(trait);
        expect(c.key).toBe(itemKey(c.ref));
        expect(c.cost).toEqual(itemCost(s, c.ref));
        for (const other of candidates(s, trait, kind === 'equipment_gap' ? 'equipment' : undefined)) {
          expect(total(c.ref, s)).toBeLessThanOrEqual(total(other, s));
        }
      }
    }
  });

  it('an equipment gap is answered by equipment', () => {
    const s = armed();
    for (const trait of TRAIT_IDS) {
      const c = counterFor({ kind: 'equipment_gap', trait }, s);
      if (candidates(s, trait, 'equipment').length > 0) expect(c?.ref.kind).toBe('equipment');
      else expect(c).toBeNull();
    }
  });

  it('never points at a mutation already owned or equipment at its last level', () => {
    const s = armed({
      mutations: makeState().mutations.map((m) => ({ ...m, purchased: true })),
      equipment: { weapon: soldierBalance.maxEquipmentLevel, armor: soldierBalance.maxEquipmentLevel },
    });
    for (const trait of TRAIT_IDS) expect(counterFor({ kind: 'outnumbered', trait }, s)).toBeNull();
  });

  it('a card it cannot buy yet is not offered (no workshop, prerequisite missing)', () => {
    const bare = makeState({ phase: 'combat' });
    for (const trait of TRAIT_IDS) {
      const c = counterFor({ kind: 'trait_beat_equipment', trait }, bare);
      if (c) expect(itemCost(bare, c.ref)).not.toBeNull();
      expect(counterFor({ kind: 'equipment_gap', trait }, bare)).toBeNull();
    }
  });

  it('says whether the card is affordable now', () => {
    const poor = armed();
    const rich = armed({ combatResources: { chitin: 10_000, silk: 10_000, venom: 10_000 } });
    for (const trait of TRAIT_IDS) {
      expect(counterFor({ kind: 'outnumbered', trait }, poor)?.affordable).toBe(false);
      expect(counterFor({ kind: 'outnumbered', trait }, rich)?.affordable).toBe(true);
    }
  });

  it('is pure: the state is not changed', () => {
    const s = armed();
    const copy = structuredClone(s);
    for (const trait of TRAIT_IDS) counterFor({ kind: 'outnumbered', trait }, s);
    expect(s).toEqual(copy);
  });
});
