import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { BattleSystem, type BattleResult } from '../../src/systems/BattleSystem';
import { battleCause, causeLine, LOSS_CAUSES, WIN_CAUSES } from '../../src/systems/BattleCauses';
import { marksOf, type BattleCause } from '../../src/systems/Counters';
import { armyOf, playOut } from '../../src/systems/CombatRounds';
import { getEnemyDef, scaleEnemy } from '../../src/systems/EnemySystem';
import { ENEMY_TYPES, ENEMIES, type EnemyType } from '../../src/data/content/enemies';
import { soldierBalance } from '../../src/data/balance/soldiers';
import type { GameState } from '../../src/state/GameState';
import { makeState, type StateOverrides } from './helpers/makeState';
import { fixedRng } from './helpers/rng';

/**
 * Story 4.3 (FR8, FR11): every battle ends in victory, defeat or draw with a
 * typed cause, emitted with `battle_completed`; drops come only with a victory.
 */

const ROLLS = [0, 0.25, 0.5, 0.75, 0.999];
const ARMIES = [1, 3, 10, 40, 200];

const combat = (over: StateOverrides = {}): GameState => makeState({ phase: 'combat', ...over });
const owning = (ids: readonly string[], over: StateOverrides = {}): GameState =>
  combat({ mutations: makeState().mutations.map((m) => ({ ...m, purchased: ids.includes(m.id) })), ...over });

function fight(s: GameState, enemy: EnemyType, roll: number): { result: BattleResult; newState: GameState; events: BattleResult[] } {
  const bus = new EventBus();
  const events: BattleResult[] = [];
  bus.subscribe('battle_completed', (r) => events.push(r));
  const { result, newState } = new BattleSystem(bus).resolveBattle(s, enemy, fixedRng(roll));
  return { result, newState, events };
}

/** Every battle the grid fights: enemies × rolls × army sizes. */
function* battles(base: (soldiers: number) => GameState = (n) => combat({ combatSoldiers: n })) {
  for (const enemy of ENEMY_TYPES) for (const roll of ROLLS) for (const n of ARMIES) yield { enemy, roll, s: base(n), ...fight(base(n), enemy, roll) };
}

describe('battle outcome and cause (Story 4.3)', () => {
  it('every battle ends in victory, defeat or draw, with a cause about the enemy fought', () => {
    const seen = new Set<string>();
    for (const { enemy, result, events } of battles()) {
      expect(['victory', 'defeat', 'draw']).toContain(result.outcome);
      expect(result.victory).toBe(result.outcome === 'victory');
      expect(result.cause.trait).toBe(ENEMIES[enemy].trait);
      const kinds: readonly string[] = result.outcome === 'victory' ? WIN_CAUSES : LOSS_CAUSES;
      expect(kinds).toContain(result.cause.kind);
      // The event carries the same cause.
      expect(events).toHaveLength(1);
      expect(events[0]!.cause).toEqual(result.cause);
      seen.add(result.outcome);
    }
    // The grid reaches all three outcomes, so the assertions above are not vacuous.
    expect([...seen].sort()).toEqual(['defeat', 'draw', 'victory']);
  });

  it('a draw is the fight running out of rounds: the army stands, the enemy flees', () => {
    for (const { result, newState, s } of battles()) {
      if (result.outcome !== 'draw') continue;
      expect(newState.combatSoldiers).toBeGreaterThan(0);
      expect(newState.battlesWon).toBe(s.battlesWon);
      expect(newState.battlesLost).toBe(s.battlesLost);
      expect(newState.lastBattle).toMatchObject({ status: 'done', result: 'draw' });
    }
  });

  it('silk, chitin and venom (and food) drop only on victory', () => {
    const stocked = (n: number) =>
      combat({ combatSoldiers: n, buildings: { venom_lab: { level: 1 } }, combatResources: { chitin: 5, silk: 5, venom: 5 } });
    let losses = 0;
    for (const { result, newState, s } of battles(stocked)) {
      if (result.outcome === 'victory') continue;
      losses++;
      expect(result.specialLoot).toEqual({ chitin: 0, silk: 0, venom: 0 });
      expect(result.foodGained).toBe(0);
      expect(newState.combatResources.chitin).toBe(s.combatResources.chitin);
      expect(newState.combatResources.silk).toBe(s.combatResources.silk);
      expect(newState.combatResources.venom).toBeLessThanOrEqual(s.combatResources.venom);
      expect(newState.resources.food).toBe(s.resources.food);
    }
    expect(losses).toBeGreaterThan(0);
  });

  it('no soldiers to send: a defeat, outnumbered, against the enemy on the card', () => {
    const s = combat({ combatSoldiers: 0, nextEnemy: 'spider' });
    const { result } = fight(s, 'spider', 0.5);
    expect(result.outcome).toBe('defeat');
    expect(result.cause).toEqual({ kind: 'outnumbered', trait: ENEMIES.spider.trait });
  });

  it('a loss against a trait that blunts an owned mutation names that mutation', () => {
    for (const { result } of battles((n) => owning(['potent_venom', 'efficient_gatherers'], { combatSoldiers: n }))) {
      if (result.outcome === 'victory' || result.cause.kind !== 'trait_beat_mutation') continue;
      expect(result.cause.upgrade).toBeDefined();
      expect(marksOf({ kind: 'mutation', id: result.cause.upgrade! }).weakAgainst).toContain(result.cause.trait);
    }
    const beetle = scaleEnemy(getEnemyDef('beetle'), 0);
    const cause = battleCause(owning(['potent_venom'], { combatSoldiers: 1 }), beetle, 'defeat');
    expect(cause).toEqual({ kind: 'trait_beat_mutation', trait: 'thick_shell', upgrade: 'potent_venom' });
    // The story's example line.
    expect(causeLine(cause)).toBe('THEIR SHELLS TURNED YOUR VENOM.');
  });

  it('a loss against a trait that blunts the equipment worn names the equipment', () => {
    const redAnt = scaleEnemy(getEnemyDef('red_ant'), 0);
    expect(marksOf({ kind: 'equipment', id: 'weapon', level: 1 }).weakAgainst).toContain('swarm');
    const cause = battleCause(combat({ combatSoldiers: 1, equipment: { weapon: 1, armor: 0 } }), redAnt, 'defeat');
    expect(cause).toEqual({ kind: 'trait_beat_equipment', trait: 'swarm', upgrade: 'weapon' });
  });

  it('an equipment gap: one more level would have won the fight the army lost', () => {
    const beetle = scaleEnemy(getEnemyDef('beetle'), 0);
    let found = 0;
    for (let n = 1; n <= 400; n++) {
      const s = combat({ combatSoldiers: n });
      const now = playOut(armyOf(s), beetle).outcome;
      const better = playOut(armyOf({ ...s, equipment: { weapon: 1, armor: 0 } }), beetle).outcome;
      if (now === 'victory' || better !== 'victory') continue;
      found++;
      const cause = battleCause(s, beetle, 'defeat');
      expect(cause.kind).toBe('equipment_gap');
      expect(cause.trait).toBe('thick_shell');
    }
    expect(found).toBeGreaterThan(0);
  });

  it('no equipment gap when every piece is at its last level: the army is outnumbered', () => {
    const max = soldierBalance.maxEquipmentLevel;
    const scorpion = scaleEnemy(getEnemyDef('scorpion'), 20);
    const cause = battleCause(combat({ combatSoldiers: 1, equipment: { weapon: max, armor: max } }), scorpion, 'defeat');
    expect(cause.kind).toBe('outnumbered');
  });

  it('a victory names the owned counter that answered the trait, or the army itself', () => {
    const kinds = new Set<string>();
    for (const { result } of battles((n) => owning(['tough_shells'], { combatSoldiers: n, equipment: { weapon: 1, armor: 0 } }))) {
      if (result.outcome !== 'victory') continue;
      kinds.add(result.cause.kind);
      if (result.cause.kind === 'trait_countered') {
        const u = result.cause.upgrade!;
        const marks = u === 'weapon' || u === 'armor' ? marksOf({ kind: 'equipment', id: u as 'weapon' | 'armor', level: 1 }) : marksOf({ kind: 'mutation', id: u });
        expect(marks.strongAgainst).toContain(result.cause.trait);
      } else {
        expect(result.cause.kind).toBe('outfought');
      }
    }
    expect(kinds.has('trait_countered')).toBe(true);
    expect(kinds.has('outfought')).toBe(true);
  });

  it('battleCause is pure and draws no roll', () => {
    const s = owning(['potent_venom'], { combatSoldiers: 5 });
    const copy = structuredClone(s);
    const enemy = scaleEnemy(getEnemyDef('termite'), 3);
    const a = battleCause(s, enemy, 'draw');
    expect(battleCause(s, enemy, 'draw')).toEqual(a);
    expect(s).toEqual(copy);
  });
});

describe('cause lines (Story 4.3, colony voice)', () => {
  it('every kind, trait and upgrade has a line', () => {
    const causes: BattleCause[] = [];
    const upgrades = [undefined, 'weapon', 'armor', ...makeState().mutations.map((m) => m.id)];
    for (const type of ENEMY_TYPES) {
      const trait = ENEMIES[type].trait;
      for (const kind of [...WIN_CAUSES, ...LOSS_CAUSES]) for (const upgrade of upgrades) causes.push({ kind, trait, upgrade });
    }
    for (const c of causes) {
      const line = causeLine(c);
      expect(line.length, JSON.stringify(c)).toBeGreaterThan(0);
      expect(line, JSON.stringify(c)).not.toMatch(/\{|\}|undefined|\s\s/);
    }
  });
});
