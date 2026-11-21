import { describe, expect, it } from 'vitest';
import { migrateSave } from '../../../src/persistence/migrations';
import { SaveManager, type SaveData } from '../../../src/persistence/SaveManager';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { PRESTIGE_UPGRADES } from '../../../src/data/prestigeTree';
import { getOfflineCapMs, getOfflineEfficiency } from '../../../src/systems/OfflineProgression';
import { OFFLINE_RESEARCH_ID } from '../../../src/systems/ResearchSystem';
import { prestige } from '../../../src/systems/PrestigeSystem';

/**
 * Story 2.8: Temporal Resonance and Chrono Synchronization had no ownership
 * flag; a save owned them when `offlineEfficiency` was 0.75 (TR) or 1.0 (both).
 * The migration grants the matching Legacy nodes (grant, not refund), so the
 * save keeps its efficiency and nothing bought is lost.
 */

/** The step that adds the Legacy offline nodes: the last one. */
const TO = SaveManager.SAVE_VERSION;
const FROM = TO - 1;

const efficiencyNode = PRESTIGE_UPGRADES.find((u) => (u.offlineEfficiencyPoints ?? 0) > 0)!;
const firstCapNode = PRESTIGE_UPGRADES.find((u) => (u.offlineCapRaiseMs ?? 0) > 0)!;

/** A save at the version before this story, with the old stored efficiency. */
function oldSave(offlineEfficiency: unknown, purchased: string[] = ['egg_laying_bonus']): SaveData {
  const gs = createInitialState() as unknown as Record<string, unknown>;
  const research = gs.research as GameState['research'];
  const projects = { ...research.projects } as Record<string, unknown>;
  delete projects[OFFLINE_RESEARCH_ID];
  return {
    version: FROM,
    timestamp: 1_763_540_000_000,
    playTimeMs: 1_000,
    gameState: {
      ...gs,
      offlineEfficiency,
      phase: 'transcendence',
      prestige: { ...(gs.prestige as object), legacyPoints: 7 },
      prestigeTree: { purchased },
      research: { projects },
    } as unknown as GameState,
  };
}

const migrate = (d: SaveData): GameState => migrateSave(d, FROM, TO).gameState;

describe(`v${FROM} → v${TO}: the old offline upgrades become Legacy nodes (Story 2.8)`, () => {
  it('a save at 50% owns neither and gains nothing', () => {
    const s = migrate(oldSave(0.5));
    expect(s.prestigeTree.purchased).toEqual(['egg_laying_bonus']);
    expect(s.research.projects[OFFLINE_RESEARCH_ID].status).toBe('idle');
    expect(getOfflineEfficiency(s)).toBe(0.5);
  });

  it('Temporal Resonance (0.75) → the Legacy efficiency node, keeping 75% without the research', () => {
    const s = migrate(oldSave(0.75));
    expect(s.prestigeTree.purchased).toContain('egg_laying_bonus');
    expect(s.prestigeTree.purchased).toContain(efficiencyNode.id);
    expect(s.prestigeTree.purchased).not.toContain(firstCapNode.id);
    expect(s.research.projects[OFFLINE_RESEARCH_ID].status).toBe('idle');
    expect(getOfflineEfficiency(s)).toBe(0.75);
    // A Legacy node survives prestige.
    expect(getOfflineEfficiency(prestige(s))).toBe(0.75);
  });

  it('both (1.0) → the efficiency node, the first cap node and this run’s research done', () => {
    const before = oldSave(1);
    const s = migrate(before);
    expect(s.prestigeTree.purchased).toContain(efficiencyNode.id);
    expect(s.prestigeTree.purchased).toContain(firstCapNode.id);
    expect(s.research.projects[OFFLINE_RESEARCH_ID].status).toBe('done');
    expect(getOfflineEfficiency(s)).toBe(1);
    expect(getOfflineCapMs(s)).toBeGreaterThan(getOfflineCapMs(createInitialState()));
    // Nothing the player had is lost: Legacy Points stay.
    expect(s.prestige.legacyPoints).toBe(7);
    // Until the next prestige, which wipes only the research.
    expect(getOfflineEfficiency(prestige(s))).toBe(0.75);
  });

  it('never grants a node twice and drops the stored efficiency', () => {
    const s = migrate(oldSave(1, ['egg_laying_bonus', efficiencyNode.id]));
    const ids = s.prestigeTree.purchased;
    expect(new Set(ids).size).toBe(ids.length);
    expect('offlineEfficiency' in s).toBe(false);
  });

  it('a malformed stored efficiency grants nothing', () => {
    for (const bad of [undefined, null, 'x', Number.NaN, 0.6]) {
      const s = migrate(oldSave(bad));
      expect(s.prestigeTree.purchased).toEqual(['egg_laying_bonus']);
      expect(getOfflineEfficiency(s)).toBe(0.5);
    }
  });
});
