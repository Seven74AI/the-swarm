import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/state/GameState';
import { createInitialState } from '../../src/state/GameState';
import {
  OFFLINE_CAP_BASE_MS,
  OFFLINE_CAP_MAX_MS,
  OFFLINE_EFFICIENCY_BASE_POINTS,
  OFFLINE_EFFICIENCY_MAX_POINTS,
  RESUME_FULL_EFFICIENCY_MS,
} from '../../src/data/constants';
import { PRESTIGE_UPGRADES, type PrestigeUpgrade } from '../../src/data/prestigeTree';
import { PANEL_PLACEMENT, isUnlocked } from '../../src/data/content/tabs';
import { RESOURCES } from '../../src/ui/shell/resourceCatalog';
import { Phase } from '../../src/phases/phases';
import { getOfflineCapMs, getOfflineEfficiency } from '../../src/systems/OfflineProgression';
import {
  OFFLINE_RESEARCH_ID,
  canStartProject,
  getProjectStatus,
  getProjects,
  startProject,
  tickResearch,
} from '../../src/systems/ResearchSystem';
import { prestige } from '../../src/systems/PrestigeSystem';
import { resume } from '../../src/engine/resume';
import { testActions } from './helpers/actions';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../src/phases/transitions';
import { makeState } from './helpers/makeState';

/**
 * Story 2.8 (FR21): offline efficiency is 50% plus 25 points for this run's
 * offline research plus 25 points for the Legacy efficiency node, never above
 * 100%. Legacy cap-raise nodes take the cap from 12 h toward 24 h.
 */

const def = () => getProjects().find((p) => p.id === OFFLINE_RESEARCH_ID)!;
const efficiencyNode = (): PrestigeUpgrade => PRESTIGE_UPGRADES.find((u) => (u.offlineEfficiencyPoints ?? 0) > 0)!;
const capNodes = (): PrestigeUpgrade[] => PRESTIGE_UPGRADES.filter((u) => (u.offlineCapRaiseMs ?? 0) > 0);

const withResearch = (s: GameState): GameState => ({
  ...s,
  research: { ...s.research, projects: { ...s.research.projects, [OFFLINE_RESEARCH_ID]: { status: 'done' } } },
});
const withNodes = (s: GameState, ids: string[]): GameState => ({
  ...s,
  prestigeTree: { purchased: [...s.prestigeTree.purchased, ...ids] },
});

/** Enough of every price entry to pay for the offline research. */
function richIn(phase: GameState['phase']): GameState {
  const resources: Record<string, number> = {};
  for (const [k, v] of Object.entries(def().cost)) resources[k] = (v ?? 0) * 2;
  return makeState({ phase, resources });
}

function deps() {
  const bus = new EventBus();
  const fsm = new PhaseStateMachine(TRANSITIONS);
  return {
    resourceSystem: new ResourceSystem(bus),
    soldierSystem: new SoldierSystem(bus),
    mapSystem: new MapSystem(),
    territorySystem: new TerritorySystem(),
    latch: (s: GameState) => fsm.latch(s),
  };
}

describe('offline efficiency (Story 2.8)', () => {
  it('a new run is at the 50% baseline', () => {
    expect(getOfflineEfficiency(createInitialState())).toBe(OFFLINE_EFFICIENCY_BASE_POINTS / 100);
    expect(OFFLINE_EFFICIENCY_BASE_POINTS).toBe(50);
  });

  it('the run research and the Legacy node each add the same points, in either order', () => {
    const base = getOfflineEfficiency(createInitialState());
    const research = getOfflineEfficiency(withResearch(createInitialState()));
    const node = getOfflineEfficiency(withNodes(createInitialState(), [efficiencyNode().id]));
    const both = getOfflineEfficiency(withNodes(withResearch(createInitialState()), [efficiencyNode().id]));
    expect(research).toBeGreaterThan(base);
    expect(node).toBe(research);
    expect(both).toBeGreaterThan(research);
    expect(both).toBe(OFFLINE_EFFICIENCY_MAX_POINTS / 100);
  });

  it('is never above 100%, whatever extra nodes exist', () => {
    const extra: PrestigeUpgrade = { ...efficiencyNode(), id: 'test_extra' as PrestigeUpgrade['id'], offlineEfficiencyPoints: 500 };
    const s = withNodes(withResearch(createInitialState()), [efficiencyNode().id, extra.id]);
    expect(getOfflineEfficiency(s, [...PRESTIGE_UPGRADES, extra])).toBe(1);
  });

  it('the offline research is open in Colony and Combat, paid in currencies those phases have', () => {
    expect(def()).toBeDefined();
    expect((def().offlineEfficiencyPoints ?? 0)).toBeGreaterThan(0);
    for (const phase of [Phase.COLONY, Phase.COMBAT]) {
      const s = richIn(phase);
      expect(getProjectStatus(s, OFFLINE_RESEARCH_ID)).toBe('available');
      expect(canStartProject(s, OFFLINE_RESEARCH_ID)).toBe(true);
    }
    for (const id of Object.keys(def().cost)) {
      const res = RESOURCES.find((r) => r.id === id);
      expect(res, id).toBeDefined();
      expect(isUnlocked(res!.unlockPhase, Phase.COLONY), id).toBe(true);
    }
    // Shown on BUILD from Colony on (no catch-22: it needs no researcher row).
    const placement = PANEL_PLACEMENT[def().panel];
    expect(placement.tab).toBe('build');
    expect(isUnlocked(placement.unlockPhase, Phase.COLONY)).toBe(true);
  });

  it('finishing the research raises the efficiency resume uses', () => {
    let s = startProject(richIn(Phase.COLONY), OFFLINE_RESEARCH_ID);
    expect(s.research.projects[OFFLINE_RESEARCH_ID].status).toBe('running');
    s = tickResearch(s, def().durationMs / 1000);
    expect(s.research.projects[OFFLINE_RESEARCH_ID].status).toBe('done');
    const before = resume(richIn(Phase.COLONY), RESUME_FULL_EFFICIENCY_MS, deps());
    const after = resume(s, RESUME_FULL_EFFICIENCY_MS, deps());
    expect(after.efficiency).toBeGreaterThan(before.efficiency);
    expect(after.offline!.efficiency).toBe(getOfflineEfficiency(s));
  });

  it('prestige wipes the run research and keeps the Legacy nodes', () => {
    const s = withNodes(withResearch(makeState({ phase: 'transcendence' })), [efficiencyNode().id, capNodes()[0].id]);
    const next = prestige(s);
    expect(next.research.projects[OFFLINE_RESEARCH_ID].status).toBe('idle');
    expect(next.prestigeTree.purchased).toContain(efficiencyNode().id);
    expect(getOfflineEfficiency(next)).toBeLessThan(getOfflineEfficiency(s));
    expect(getOfflineEfficiency(next)).toBeGreaterThan(getOfflineEfficiency(createInitialState()));
    expect(getOfflineCapMs(next)).toBe(getOfflineCapMs(s));
  });

  it('Legacy cap-raise nodes take the cap from 12 h to 24 h, never past it', () => {
    expect(capNodes().length).toBeGreaterThan(0);
    let s = createInitialState();
    let cap = getOfflineCapMs(s);
    expect(cap).toBe(OFFLINE_CAP_BASE_MS);
    for (const node of capNodes()) {
      s = withNodes(s, [node.id]);
      const next = getOfflineCapMs(s);
      expect(next).toBeGreaterThan(cap);
      cap = next;
    }
    expect(cap).toBe(OFFLINE_CAP_MAX_MS);
  });

  it('the Legacy nodes are bought like any Legacy upgrade; the old offline buys are gone', () => {
    const bus = new EventBus();
    let state = makeState({ phase: 'transcendence', prestige: { legacyPoints: 1_000 } });
    const actions = testActions(bus, () => state, (s) => { state = s; });
    expect('buyTemporalResonance' in actions).toBe(false);
    expect('buyChronoSynchronization' in actions).toBe(false);
    for (const node of [efficiencyNode(), ...capNodes()]) {
      expect(actions.buyPrestigeUpgrade(node.id).ok).toBe(true);
    }
    expect(getOfflineEfficiency(state)).toBeGreaterThan(getOfflineEfficiency(createInitialState()));
    expect(getOfflineCapMs(state)).toBe(OFFLINE_CAP_MAX_MS);
  });

  it('the state no longer stores an efficiency of its own', () => {
    expect('offlineEfficiency' in createInitialState()).toBe(false);
  });
});
