import { describe, it, expect } from 'vitest';
import {
  buildItems,
  getBuildAction,
  getNextAction,
  isItemAffordable,
  itemCost,
  itemKey,
  type ItemRef,
  type NextAction,
  type SuggestedAction,
} from '../../../src/systems/NextAction';
import { PANEL_PLACEMENT } from '../../../src/data/content/tabs';
import { Phase } from '../../../src/phases/phases';
import { getUpgradeCost } from '../../../src/systems/ResourceSystem';
import { getProjects } from '../../../src/systems/ResearchSystem';
import type { GameState } from '../../../src/state/GameState';
import { makeState } from '../helpers/makeState';
import { testActions } from '../helpers/actions';
import { EventBus } from '../../../src/engine/EventBus';

/**
 * Story 1.24 (UX-DR17): BUILD highlights one card, whose action is the tab's
 * primary `> BUY`. `getBuildAction(state)` picks it among the items BUILD
 * sells (Click Power from Phase 2, the buildings, the research chain): an
 * affordable critical-path item first, then any affordable one; with nothing
 * affordable, none and the BUILD item that becomes affordable soonest (the
 * header's `NEXT: <item> IN ~<time>`).
 */

function act(n: NextAction): SuggestedAction {
  if (n.kind !== 'act') throw new Error(`expected a suggestion, got ${JSON.stringify(n)}`);
  return n;
}

const broke = { food: 0, wood: 0, stone: 0, nectar: 0, voidCrystals: 0, antimatter: 0, darkMatter: 0 };

/** Add exactly an item's cost to the stock. */
function withCost(s: GameState, ref: ItemRef): GameState {
  const cost = itemCost(s, ref);
  if (!cost) return s;
  const resources = { ...s.resources };
  const combat = { ...s.combatResources };
  for (const [k, v] of Object.entries(cost)) {
    if (k in combat) combat[k as keyof typeof combat] += v;
    else resources[k as keyof typeof resources] += v;
  }
  return { ...s, resources, combatResources: combat };
}

const soldOnBuild = (s: GameState, ref: ItemRef): boolean => buildItems(s).some((r) => itemKey(r) === itemKey(ref));

describe('BUILD items (Story 1.24)', () => {
  it('sells Click Power from Phase 2, never in Phase 1 (UX-DR18)', () => {
    const clickPower: ItemRef = { kind: 'upgrade', id: 'click_power' };
    expect(soldOnBuild(makeState({ phase: Phase.EGG_LAYING }), clickPower)).toBe(false);
    for (const phase of [Phase.COLONY, Phase.COMBAT, Phase.EXPANSION, Phase.SPACE, Phase.TRANSCENDENCE]) {
      expect(soldOnBuild(makeState({ phase }), clickPower), phase).toBe(true);
    }
  });

  it('lists every building and research project, and nothing sold on another tab', () => {
    const s = makeState({ phase: Phase.SPACE });
    const keys = buildItems(s).map(itemKey);
    for (const b of ['barracks', 'walls', 'warehouse', 'fungus_garden', 'tunnels', 'silk_weaving', 'chitin_armory', 'venom_lab', 'midden']) {
      expect(keys).toContain(`building:${b}`);
    }
    for (const p of getProjects()) expect(keys).toContain(`research:${p.id}`);
    expect(keys.some((k) => k.startsWith('mutation:') || k.startsWith('auto_') || k === 'ship' || k.startsWith('equipment:'))).toBe(false);
  });
});

describe('getBuildAction (Story 1.24)', () => {
  it('highlights an affordable BUILD item, which the action buys', () => {
    let s = withCost(makeState({ phase: Phase.EXPANSION, resources: broke }), { kind: 'building', id: 'walls' });
    const n = act(getBuildAction(s));
    expect(n.key).toBe('building:walls');
    expect(n.verb).toBe('BUY');
    const actions = testActions(new EventBus(), () => s, (next) => { s = next; });
    expect(actions.perform(n.intent)).toEqual({ ok: true });
    expect(s.buildings.walls.level).toBeGreaterThan(0);
  });

  it('prefers the phase critical path over other affordable items', () => {
    let s = makeState({ phase: Phase.EXPANSION, resources: broke });
    s = withCost(s, { kind: 'building', id: 'walls' });
    s = withCost(s, { kind: 'building', id: 'warehouse' });
    expect(act(getBuildAction(s)).key).toBe('building:warehouse');
  });

  it('never highlights an item sold on another tab, even when the next action is one', () => {
    const s = makeState({
      phase: Phase.COMBAT,
      resources: { ...broke, food: 1_000_000 },
      combatResources: { chitin: 1_000_000, silk: 1_000_000, venom: 1_000_000 },
    });
    const global = act(getNextAction(s));
    expect(global.key.startsWith('mutation:') || global.key.startsWith('equipment:')).toBe(true);
    const n = getBuildAction(s);
    if (n.kind === 'act') expect(PANEL_PLACEMENT[n.panel].tab).toBe('build');
  });

  it('highlights Click Power on BUILD from Phase 2, and its suggestion opens BUILD', () => {
    const s = makeState({ phase: Phase.COLONY, resources: { ...broke, food: getUpgradeCost('click_power', 0)! } });
    const n = act(getBuildAction(s));
    expect(n.key).toBe('upgrade:click_power');
    expect(PANEL_PLACEMENT[n.panel].tab).toBe('build');
  });

  it('is none in Phase 1 (BUILD does not exist yet)', () => {
    const s = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1_000_000 } });
    expect(getBuildAction(s).kind).toBe('none');
  });

  it('with nothing affordable, names the BUILD item that becomes affordable soonest', () => {
    const s = makeState({
      phase: Phase.COLONY,
      resources: { ...broke, workers: 10 },
      workersAssigned: { gather: 10, tend: 0, dig: 0, guard: 0, researchers: 0 },
    });
    const n = getBuildAction(s);
    expect(n.kind).toBe('none');
    if (n.kind !== 'none') return;
    expect(n.nextAffordable).not.toBeNull();
    expect(n.nextAffordable!.key).toBe('upgrade:click_power');
    expect(n.nextAffordable!.inSec).toBeGreaterThan(0);
    expect(Number.isInteger(n.nextAffordable!.inSec)).toBe(true);
  });

  it('only highlights items the player can afford now', () => {
    const s = withCost(makeState({ phase: Phase.SPACE, resources: broke }), { kind: 'building', id: 'barracks' });
    const n = act(getBuildAction(s));
    const ref = buildItems(s).find((r) => itemKey(r) === n.key)!;
    expect(isItemAffordable(s, ref)).toBe(true);
  });
});
