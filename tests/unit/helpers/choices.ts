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
  const costA = itemCost(s, a) ?? {};
  const costB = itemCost(s, b) ?? {};
  const stocks = new Set([...Object.keys(costA), ...Object.keys(costB)]) as Set<keyof ItemCost>;
  const cheaper = [...stocks].every((k) => (costA[k] ?? 0) <= (costB[k] ?? 0));
  const effA = itemEffects(s, a) ?? {};
  const effB = itemEffects(s, b) ?? {};
  const kinds = new Set([...Object.keys(effA), ...Object.keys(effB)]);
  const better = [...kinds].every((k) => (effA[k] ?? 0) >= (effB[k] ?? 0));
  return cheaper && better;
}
