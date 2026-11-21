import type { Phase } from '../../../src/phases/phases';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { itemCost, itemEffects, itemPanel, listItems, type ItemCost, type ItemRef } from '../../../src/systems/NextAction';
import { PANEL_PLACEMENT, isUnlocked } from '../../../src/data/content/tabs';

/**
 * "Choices worth making" (FR19, Epic 4 stories 4.6–4.8): the purchasables a
 * phase sells and the "none strictly dominant" check, shared by each phase's
 * test. Purchasables are every item the next-action rule knows that a panel
 * open in the phase sells to a fresh colony there; their prices come from
 * `itemCost` and their effects from `itemEffects` (data, never restated).
 */

/** A fresh colony in `phase`. */
export function freshIn(phase: Phase): GameState {
  return { ...createInitialState(), phase };
}

/** Items sold in `phase` (by a panel open in it) and open at some price in `s`. */
export function purchasablesIn(phase: Phase, s: GameState = freshIn(phase)): ItemRef[] {
  return listItems().filter((ref) => isUnlocked(PANEL_PLACEMENT[itemPanel(ref)].unlockPhase, phase) && itemCost(s, ref) !== null);
}

/** The items that spend each currency. */
export function byCurrency(s: GameState, items: readonly ItemRef[]): Map<keyof ItemCost, ItemRef[]> {
  const out = new Map<keyof ItemCost, ItemRef[]>();
  for (const ref of items) {
    for (const k of Object.keys(itemCost(s, ref) ?? {}) as (keyof ItemCost)[]) out.set(k, [...(out.get(k) ?? []), ref]);
  }
  return out;
}

/**
 * `a` strictly dominates `b`: it costs the same or less on every stock either
 * names, and gives at least as much of every effect either gives.
 */
export function dominates(s: GameState, a: ItemRef, b: ItemRef): boolean {
  return dominatesProfile(
    { cost: itemCost(s, a) ?? {}, effects: itemEffects(s, a) ?? {} },
    { cost: itemCost(s, b) ?? {}, effects: itemEffects(s, b) ?? {} },
  );
}

/**
 * A purchase as the dominance check sees it: its price by stock and its
 * effects by name (every value a gain; a key one side lacks counts as 0).
 * Story 4.8 measures Combat's effects in the fight and passes them here.
 */
export interface Profile {
  readonly cost: Readonly<Record<string, number | undefined>>;
  readonly effects: Readonly<Record<string, number | undefined>>;
}

/** Effects closer than this count as equal (measured fights are not exact). */
const EPSILON = 1e-9;

/** `a` costs the same or less on every stock either names and gives at least as much of every effect either gives. */
export function dominatesProfile(a: Profile, b: Profile): boolean {
  const stocks = new Set([...Object.keys(a.cost), ...Object.keys(b.cost)]);
  const cheaper = [...stocks].every((k) => (a.cost[k] ?? 0) <= (b.cost[k] ?? 0));
  const kinds = new Set([...Object.keys(a.effects), ...Object.keys(b.effects)]);
  const better = [...kinds].every((k) => (a.effects[k] ?? 0) >= (b.effects[k] ?? 0) - EPSILON);
  return cheaper && better;
}
