import type { GameState } from '../state/GameState';
import type { EnemyDef } from './EnemySystem';
import { armyOf, playOut, type BattleOutcome } from './CombatRounds';
import { marksOf, type BattleCause, type BattleCauseKind, type CauseUpgrade, type CounterMarks } from './Counters';
import { MUTATIONS } from './MutationSystem';
import { soldierBalance } from '../data/balance/soldiers';
import { colonyLine } from '../data/content/colonyLines';
import { CAUSE_ARMY_WORD, CAUSE_EQUIPMENT_WORD, CAUSE_TRAIT_WORDS, CAUSE_UPGRADE_WORDS } from '../data/content/battleCauses';

/**
 * Why a battle went the way it did (Story 4.3, FR11, UX-DR25): one cause per
 * battle, decided from the army that fought and the enemy's trait, never from
 * a roll, so the same army against the same enemy always reads the same way.
 *
 * A loss or a draw, in order:
 * 1. no soldiers: `outnumbered`;
 * 2. an owned mutation marked weak against the trait: `trait_beat_mutation`
 *    (the latest one in the mutation list, so Potent Venom before the roots);
 * 3. equipment worn whose level is marked weak against it: `trait_beat_equipment`;
 * 4. the army loses the fight played out with middle rolls, and one more level
 *    of a piece of equipment wins it: `equipment_gap`;
 * 5. otherwise `outnumbered`: more soldiers (or luck) were needed.
 * A victory: an owned counter strong against the trait, `trait_countered`; else `outfought`.
 */

export const WIN_CAUSES: readonly BattleCauseKind[] = ['trait_countered', 'outfought'];
export const LOSS_CAUSES: readonly BattleCauseKind[] = ['trait_beat_mutation', 'trait_beat_equipment', 'equipment_gap', 'outnumbered'];

const PIECES = ['weapon', 'armor'] as const;

function ownedMutations(state: GameState): string[] {
  const owned = new Set(state.mutations.filter((m) => m.purchased).map((m) => m.id));
  // Latest first: the later mutations are the ones bought on purpose.
  return MUTATIONS.map((m) => m.id).filter((id) => owned.has(id)).reverse();
}

const equipmentMarks = (state: GameState, id: (typeof PIECES)[number]): CounterMarks =>
  marksOf({ kind: 'equipment', id, level: state.equipment[id] });

export function battleCause(state: GameState, enemy: EnemyDef, outcome: BattleOutcome): BattleCause {
  const trait = enemy.trait;
  const mutations = ownedMutations(state);
  const worn = PIECES.filter((id) => state.equipment[id] >= 1);

  if (outcome === 'victory') {
    const m = mutations.find((id) => marksOf({ kind: 'mutation', id }).strongAgainst.includes(trait));
    const e = worn.find((id) => equipmentMarks(state, id).strongAgainst.includes(trait));
    const upgrade: CauseUpgrade | undefined = m ?? e;
    return upgrade !== undefined ? { kind: 'trait_countered', trait, upgrade } : { kind: 'outfought', trait };
  }

  if (state.combatSoldiers <= 0) return { kind: 'outnumbered', trait };

  const weakMutation = mutations.find((id) => marksOf({ kind: 'mutation', id }).weakAgainst.includes(trait));
  if (weakMutation !== undefined) return { kind: 'trait_beat_mutation', trait, upgrade: weakMutation };

  const weakPiece = worn.find((id) => equipmentMarks(state, id).weakAgainst.includes(trait));
  if (weakPiece !== undefined) return { kind: 'trait_beat_equipment', trait, upgrade: weakPiece };

  if (playOut(armyOf(state), enemy).outcome !== 'victory') {
    const below = PIECES.filter((id) => state.equipment[id] < soldierBalance.maxEquipmentLevel);
    const raised = (ids: readonly (typeof PIECES)[number][]): GameState => ({
      ...state,
      equipment: { ...state.equipment, ...Object.fromEntries(ids.map((id) => [id, state.equipment[id] + 1])) },
    });
    const wins = (s: GameState): boolean => playOut(armyOf(s), enemy).outcome === 'victory';
    const piece = below.find((id) => wins(raised([id])));
    if (piece !== undefined) return { kind: 'equipment_gap', trait, upgrade: piece };
    if (below.length > 1 && wins(raised(below))) return { kind: 'equipment_gap', trait };
  }

  return { kind: 'outnumbered', trait };
}

const upgradeWord = (u: CauseUpgrade | undefined, fallback: string): string =>
  (u !== undefined ? CAUSE_UPGRADE_WORDS[u] : undefined) ?? fallback;

/** The cause line the battle summary shows, in the colony's voice: `THEIR SHELLS TURNED YOUR VENOM.` */
export function causeLine(cause: BattleCause): string {
  const words = CAUSE_TRAIT_WORDS[cause.trait];
  switch (cause.kind) {
    case 'trait_beat_mutation':
    case 'trait_beat_equipment':
      return colonyLine('cause_trait_beat', { their: words.their, beat: words.beat, upgrade: upgradeWord(cause.upgrade, CAUSE_ARMY_WORD) });
    case 'equipment_gap':
      return colonyLine('cause_equipment_gap', { upgrade: upgradeWord(cause.upgrade, CAUSE_EQUIPMENT_WORD) });
    case 'outnumbered':
      return colonyLine('cause_outnumbered');
    case 'trait_countered':
      return colonyLine('cause_trait_countered', { their: words.their, upgrade: upgradeWord(cause.upgrade, CAUSE_ARMY_WORD) });
    case 'outfought':
      return colonyLine('cause_outfought');
  }
}
